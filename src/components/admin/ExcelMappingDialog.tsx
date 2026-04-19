import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Save, Sparkles } from "lucide-react";

export interface MappingTarget {
  field_key: string;
  label: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tableName: string;
  file: File | null;
  /** 시스템 필드 후보 (고정 컬럼 + 동적 필드 합친 결과) */
  targets: MappingTarget[];
  /** 매핑 확정 시 호출. mappedRows = [{field_key: value, ...}] */
  onConfirm: (mappedRows: Record<string, any>[]) => Promise<void> | void;
}

const SKIP = "__skip__";

/** 자동 매핑: 헤더명이 label/key와 정확히 같으면 매핑 */
const autoMap = (headers: string[], targets: MappingTarget[]) => {
  const m: Record<string, string> = {};
  for (const h of headers) {
    const t = targets.find(
      (t) => t.label === h || t.field_key === h || t.label.replace(/[\s()₩]/g, "") === h.replace(/[\s()₩]/g, ""),
    );
    if (t) m[h] = t.field_key;
    else m[h] = SKIP;
  }
  return m;
};

export const ExcelMappingDialog = ({
  open,
  onOpenChange,
  tableName,
  file,
  targets,
  onConfirm,
}: Props) => {
  const { user } = useAuth();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [presets, setPresets] = useState<{ id: string; preset_name: string; mapping: any }[]>([]);
  const [presetName, setPresetName] = useState("");
  const [working, setWorking] = useState(false);

  // 엑셀 파일 파싱
  useEffect(() => {
    if (!file || !open) return;
    (async () => {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const hs = json.length ? Object.keys(json[0]) : [];
      setHeaders(hs);
      setRows(json);
      setMapping(autoMap(hs, targets));
    })();
  }, [file, open, targets]);

  // 프리셋 로드
  useEffect(() => {
    if (!open) return;
    supabase
      .from("excel_mappings")
      .select("id, preset_name, mapping")
      .eq("table_name", tableName)
      .order("updated_at", { ascending: false })
      .then(({ data }) => setPresets(data ?? []));
  }, [open, tableName]);

  const mappedCount = useMemo(
    () => Object.values(mapping).filter((v) => v && v !== SKIP).length,
    [mapping],
  );

  const applyPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    const next: Record<string, string> = {};
    for (const h of headers) next[h] = (p.mapping as any)?.[h] ?? SKIP;
    setMapping(next);
    toast.success(`프리셋 "${p.preset_name}" 적용`);
  };

  const savePreset = async () => {
    if (!user) return;
    const name = presetName.trim();
    if (!name) return toast.error("프리셋 이름을 입력하세요");
    const cleaned: Record<string, string> = {};
    Object.entries(mapping).forEach(([k, v]) => {
      if (v && v !== SKIP) cleaned[k] = v;
    });
    const { error } = await supabase.from("excel_mappings").upsert(
      {
        table_name: tableName,
        preset_name: name,
        mapping: cleaned,
        created_by: user.id,
      },
      { onConflict: "table_name,preset_name" },
    );
    if (error) toast.error(error.message);
    else {
      toast.success("프리셋 저장됨");
      setPresetName("");
    }
  };

  const confirm = async () => {
    setWorking(true);
    try {
      const mapped = rows.map((r) => {
        const o: Record<string, any> = {};
        for (const [header, fieldKey] of Object.entries(mapping)) {
          if (!fieldKey || fieldKey === SKIP) continue;
          o[fieldKey] = r[header];
        }
        return o;
      });
      await onConfirm(mapped);
      onOpenChange(false);
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary-glow" /> 엑셀 컬럼 매핑
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground mb-3">
          엑셀 헤더 ({headers.length}개) → 시스템 필드로 연결하세요. 자동 매핑된 항목은 그대로
          저장하면 됩니다.{" "}
          <Badge variant="outline" className="ml-1">
            매핑됨 {mappedCount} / {headers.length}
          </Badge>
        </div>

        {/* 프리셋 */}
        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-lg border border-border/40 bg-muted/20">
          <span className="text-xs font-semibold">프리셋:</span>
          {presets.length === 0 ? (
            <span className="text-xs text-muted-foreground">저장된 프리셋 없음</span>
          ) : (
            <Select onValueChange={applyPreset}>
              <SelectTrigger className="h-8 w-56">
                <SelectValue placeholder="불러오기…" />
              </SelectTrigger>
              <SelectContent>
                {presets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.preset_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex-1" />
          <Input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="현재 매핑을 프리셋으로 저장"
            className="h-8 w-60"
          />
          <Button size="sm" variant="outline" onClick={savePreset}>
            <Save className="size-3.5 mr-1" /> 저장
          </Button>
        </div>

        {/* 매핑 테이블 */}
        <div className="rounded-lg border border-border/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">엑셀 헤더</th>
                <th className="text-left px-3 py-2">샘플 값</th>
                <th className="text-left px-3 py-2">시스템 필드</th>
              </tr>
            </thead>
            <tbody>
              {headers.map((h) => (
                <tr key={h} className="border-t border-border/30">
                  <td className="px-3 py-2 font-medium">{h}</td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-[180px]">
                    {String(rows[0]?.[h] ?? "")}
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={mapping[h] ?? SKIP}
                      onValueChange={(v) => setMapping({ ...mapping, [h]: v })}
                    >
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP}>— 무시 —</SelectItem>
                        {targets.map((t) => (
                          <SelectItem key={t.field_key} value={t.field_key}>
                            {t.label}{" "}
                            <span className="text-xs text-muted-foreground">({t.field_key})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={confirm} disabled={working || mappedCount === 0}>
            {working ? "저장 중…" : `${rows.length}건 등록`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
