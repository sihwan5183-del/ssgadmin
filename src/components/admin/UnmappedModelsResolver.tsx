import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Sparkles, Wand2, RefreshCcw, Plus, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { useDeviceModels } from "@/hooks/useDeviceModels";
import { toast } from "sonner";

/**
 * 미매칭 단말기 모델(unmapped_model) 일괄 해결 도구.
 * sales / device_inventory 테이블의 custom_fields.unmapped_model 코드들을 모아
 *   1) 기존 모델 마스터의 alias 로 등록 (선택 → 매칭 → 적용)
 *   2) 새 모델로 즉시 등록
 * 적용 후 해당 행들을 다시 저장하면 트리거가 자동 정규화하여
 * device_model 컬럼이 채워지고 대시보드 모델별 분석에 반영됩니다.
 */

type UnmappedRow = {
  code: string;
  salesCount: number;
  inventoryCount: number;
  saleIds: string[];
  inventoryIds: string[];
};

export const UnmappedModelsResolver = () => {
  const { models, reload: refreshModels } = useDeviceModels(false);
  const [rows, setRows] = useState<UnmappedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({}); // code → target model_name

  const load = async () => {
    setLoading(true);
    try {
      const [salesRows, invRes] = await Promise.all([
        fetchAllRows(({ from, to }) =>
          supabase
            .from("sales")
            .select("id, custom_fields")
            .not("custom_fields->>unmapped_model", "is", null)
            .range(from, to)
        ),
        supabase
          .from("device_inventory")
          .select("id, custom_fields")
          .not("custom_fields->>unmapped_model", "is", null)
          .limit(2000),
      ]);
      const salesRes = { data: salesRows };

      const map = new Map<string, UnmappedRow>();
      (salesRes.data ?? []).forEach((r: any) => {
        const code = String(r.custom_fields?.unmapped_model ?? "").trim();
        if (!code) return;
        const cur = map.get(code) ?? { code, salesCount: 0, inventoryCount: 0, saleIds: [], inventoryIds: [] };
        cur.salesCount += 1;
        cur.saleIds.push(r.id);
        map.set(code, cur);
      });
      (invRes.data ?? []).forEach((r: any) => {
        const code = String(r.custom_fields?.unmapped_model ?? "").trim();
        if (!code) return;
        const cur = map.get(code) ?? { code, salesCount: 0, inventoryCount: 0, saleIds: [], inventoryIds: [] };
        cur.inventoryCount += 1;
        cur.inventoryIds.push(r.id);
        map.set(code, cur);
      });

      setRows(Array.from(map.values()).sort((a, b) => (b.salesCount + b.inventoryCount) - (a.salesCount + a.inventoryCount)));
    } catch (e) {
      toast.error("미매칭 모델 로드 실패", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalRows = useMemo(() => rows.reduce((s, r) => s + r.salesCount + r.inventoryCount, 0), [rows]);

  /** 모델 마스터에서 가장 비슷한 후보 추천 */
  const suggestFor = (code: string) => {
    const c = code.toLowerCase().replace(/[\s\-_]+/g, "");
    let best: { name: string; score: number } | null = null;
    for (const m of models) {
      const candidates = [m.model_name, m.official_name ?? "", ...(m.aliases ?? [])];
      for (const cand of candidates) {
        if (!cand) continue;
        const cn = cand.toLowerCase().replace(/[\s\-_]+/g, "");
        if (!cn) continue;
        let score = 0;
        if (cn === c) score = 100;
        else if (c.includes(cn) || cn.includes(c)) score = 60 + Math.min(cn.length, c.length);
        if (score > (best?.score ?? 0)) best = { name: m.model_name, score };
      }
    }
    return best && best.score > 0 ? best.name : "";
  };

  /** 자동 추천 일괄 채움 */
  const autoSuggest = () => {
    const next: Record<string, string> = { ...picked };
    let filled = 0;
    rows.forEach((r) => {
      if (!next[r.code]) {
        const s = suggestFor(r.code);
        if (s) { next[r.code] = s; filled += 1; }
      }
    });
    setPicked(next);
    toast.success(`${filled}개 코드에 추천을 자동 채웠습니다`);
  };

  /** 한 코드를 선택된 모델의 alias 로 등록하고 관련 행 재정규화 */
  const applyAlias = async (row: UnmappedRow) => {
    const target = picked[row.code];
    if (!target) return toast.error("연결할 모델을 선택하세요");
    setBusyCode(row.code);
    try {
      // 1) 모델 마스터의 aliases 에 코드 추가
      const m = models.find((x) => x.model_name === target);
      if (!m) throw new Error("모델 마스터에서 대상 모델을 찾을 수 없습니다");
      const newAliases = Array.from(new Set([...(m.aliases ?? []), row.code]));
      const { error: upErr } = await supabase
        .from("device_models")
        .update({ aliases: newAliases })
        .eq("id", m.id);
      if (upErr) throw upErr;

      // 2) 관련 sales / device_inventory 의 device_model/model 을 target 으로 직접 갱신
      //    custom_fields.unmapped_model 도 제거
      if (row.saleIds.length > 0) {
        // unmapped_model 키 제거를 위해 행별로 처리 (jsonb_set 미지원이라 read-modify-write)
        const { data: salesRows } = await supabase
          .from("sales")
          .select("id, custom_fields")
          .in("id", row.saleIds);
        for (const s of salesRows ?? []) {
          const cf = { ...(s.custom_fields as any) };
          delete cf.unmapped_model;
          await supabase.from("sales").update({ device_model: target, custom_fields: cf }).eq("id", s.id);
        }
      }
      if (row.inventoryIds.length > 0) {
        const { data: invRows } = await supabase
          .from("device_inventory")
          .select("id, custom_fields")
          .in("id", row.inventoryIds);
        for (const s of invRows ?? []) {
          const cf = { ...(s.custom_fields as any) };
          delete cf.unmapped_model;
          await supabase.from("device_inventory").update({ model: target, custom_fields: cf }).eq("id", s.id);
        }
      }

      toast.success(`"${row.code}" → ${target} 연결 완료 (${row.salesCount + row.inventoryCount}건 갱신)`);
      await refreshModels();
      await load();
    } catch (e) {
      toast.error("적용 실패", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusyCode(null);
    }
  };

  /** 코드 자체를 새 모델로 등록 */
  const createAsNew = async (row: UnmappedRow) => {
    setBusyCode(row.code);
    try {
      const { data: ins, error } = await supabase
        .from("device_models")
        .insert({ model_name: row.code, manufacturer: "기타", aliases: [row.code], active: true, retail_price: 0 })
        .select()
        .single();
      if (error) throw error;

      // 관련 행들 갱신
      if (row.saleIds.length > 0) {
        const { data: salesRows } = await supabase
          .from("sales")
          .select("id, custom_fields")
          .in("id", row.saleIds);
        for (const s of salesRows ?? []) {
          const cf = { ...(s.custom_fields as any) };
          delete cf.unmapped_model;
          await supabase.from("sales").update({ device_model: ins.model_name, custom_fields: cf }).eq("id", s.id);
        }
      }
      if (row.inventoryIds.length > 0) {
        const { data: invRows } = await supabase
          .from("device_inventory")
          .select("id, custom_fields")
          .in("id", row.inventoryIds);
        for (const s of invRows ?? []) {
          const cf = { ...(s.custom_fields as any) };
          delete cf.unmapped_model;
          await supabase.from("device_inventory").update({ model: ins.model_name, custom_fields: cf }).eq("id", s.id);
        }
      }

      toast.success(`"${row.code}" 새 모델로 등록 완료`);
      await refreshModels();
      await load();
    } catch (e) {
      toast.error("새 모델 등록 실패", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusyCode(null);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-400" />
            미매칭 단말기 코드
            {rows.length > 0 && <Badge variant="outline" className="text-[10px]">{rows.length}종 · 총 {totalRows}건</Badge>}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            엑셀 업로드 시 모델 마스터에 없어 정규화되지 않은 코드입니다. 적절한 모델을 선택해 별칭(alias)으로 등록하면 대시보드 모델별 분석에 즉시 반영됩니다.
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCcw className={`size-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> 새로고침
          </Button>
          <Button size="sm" variant="outline" onClick={autoSuggest} disabled={rows.length === 0}>
            <Sparkles className="size-3.5 mr-1" /> 자동 추천 채우기
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8 rounded-lg border border-dashed border-border/40">
          {loading ? "로드 중…" : "✓ 모든 단말기 코드가 모델 마스터와 매칭되어 있습니다"}
        </div>
      ) : (
        <ScrollArea className="max-h-[460px] rounded-lg border border-border/40">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground sticky top-0">
              <tr>
                <th className="text-left px-3 py-2">코드</th>
                <th className="text-left px-3 py-2 w-24">실적</th>
                <th className="text-left px-3 py-2 w-24">재고</th>
                <th className="text-left px-3 py-2">연결할 모델</th>
                <th className="text-right px-3 py-2 w-44">작업</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.code} className="border-t border-border/30">
                  <td className="px-3 py-2 font-mono text-xs">{row.code}</td>
                  <td className="px-3 py-2 text-xs">
                    {row.salesCount > 0 ? <Badge variant="outline">{row.salesCount}건</Badge> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {row.inventoryCount > 0 ? <Badge variant="outline">{row.inventoryCount}건</Badge> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Select value={picked[row.code] ?? ""} onValueChange={(v) => setPicked({ ...picked, [row.code]: v })}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="모델 선택…" />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((m) => (
                          <SelectItem key={m.id} value={m.model_name}>
                            {m.model_name} {m.official_name && <span className="text-xs text-muted-foreground ml-1">({m.official_name})</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applyAlias(row)}
                        disabled={!picked[row.code] || busyCode === row.code}
                      >
                        <Link2 className="size-3.5 mr-1" /> 연결
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => createAsNew(row)}
                        disabled={busyCode === row.code}
                        title="이 코드를 그대로 새 모델로 등록"
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </Card>
  );
};
