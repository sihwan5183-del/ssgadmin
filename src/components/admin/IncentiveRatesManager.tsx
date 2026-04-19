import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MoneyInput } from "@/components/ui/money-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Coins, Plus, Trash2, Save, Calendar, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIncentiveRates } from "@/hooks/useIncentiveRates";
import { SALE_TYPES, PRODUCTS } from "@/data/salesOptions";
import { useDeviceModels } from "@/hooks/useDeviceModels";
import { toast } from "sonner";

const NONE = "__none";

interface DraftRow {
  id?: string;
  label: string;
  match_sale_type: string | null;
  match_product: string | null;
  match_model: string | null;
  amount: number;
  priority: number;
  active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  note: string | null;
  isNew?: boolean;
  dirty?: boolean;
}

export function IncentiveRatesManager() {
  const { user } = useAuth();
  const { rates, refresh } = useIncentiveRates();
  const { models } = useDeviceModels();

  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});

  // Merge persisted rates with local drafts for rendering
  const rows: DraftRow[] = [
    ...rates.map((r) => drafts[r.id] ?? {
      id: r.id,
      label: r.label,
      match_sale_type: r.match_sale_type,
      match_product: r.match_product,
      match_model: r.match_model,
      amount: Number(r.amount),
      priority: r.priority,
      active: r.active,
      valid_from: r.valid_from,
      valid_to: r.valid_to,
      note: r.note,
    }),
    ...Object.values(drafts).filter((d) => d.isNew),
  ];

  const addDraft = (preset?: Partial<DraftRow>) => {
    const tmpId = "new_" + Math.random().toString(36).slice(2, 9);
    setDrafts((d) => ({
      ...d,
      [tmpId]: {
        id: tmpId,
        label: preset?.label ?? "신규 인센티브",
        match_sale_type: preset?.match_sale_type ?? null,
        match_product: preset?.match_product ?? null,
        match_model: preset?.match_model ?? null,
        amount: preset?.amount ?? 0,
        priority: preset?.priority ?? 0,
        active: preset?.active ?? true,
        valid_from: preset?.valid_from ?? null,
        valid_to: preset?.valid_to ?? null,
        note: preset?.note ?? null,
        isNew: true,
        dirty: true,
      },
    }));
  };

  const updateDraft = (id: string, patch: Partial<DraftRow>) => {
    setDrafts((d) => {
      const base = d[id] ?? rows.find((r) => r.id === id);
      if (!base) return d;
      return { ...d, [id]: { ...base, ...patch, dirty: true } };
    });
  };

  const saveRow = async (row: DraftRow) => {
    const payload = {
      label: row.label,
      scope: "combo",
      match_sale_type: row.match_sale_type,
      match_product: row.match_product,
      match_model: row.match_model,
      amount: row.amount,
      priority: row.priority,
      active: row.active,
      valid_from: row.valid_from,
      valid_to: row.valid_to,
      note: row.note,
    };
    if (row.isNew) {
      const { error } = await supabase.from("incentive_rates").insert({ ...payload, created_by: user?.id });
      if (error) return toast.error("저장 실패: " + error.message);
    } else if (row.id) {
      const { error } = await supabase.from("incentive_rates").update(payload).eq("id", row.id);
      if (error) return toast.error("저장 실패: " + error.message);
    }
    toast.success("저장되었습니다");
    setDrafts((d) => {
      const c = { ...d };
      if (row.id) delete c[row.id];
      return c;
    });
    refresh();
  };

  const deleteRow = async (row: DraftRow) => {
    if (row.isNew) {
      setDrafts((d) => {
        const c = { ...d };
        if (row.id) delete c[row.id];
        return c;
      });
      return;
    }
    if (!row.id) return;
    if (!confirm(`'${row.label}' 단가를 삭제할까요?`)) return;
    const { error } = await supabase.from("incentive_rates").delete().eq("id", row.id);
    if (error) return toast.error("삭제 실패: " + error.message);
    toast.success("삭제되었습니다");
    refresh();
  };

  return (
    <Card className="p-6 glass space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Coins className="size-4 text-amber-400" /> 인센티브 단가 마스터
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            항목(번호이동/기변/신규), 상품(인터넷·TV·IOT 등), 모델별로 인센티브 단가를 설정합니다.
            여러 규칙이 매칭되면 모두 합산됩니다 (예: 기본 단가 + 주간 프로모션).
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            특정 기간만 적용되는 프로모션은 <span className="text-amber-400 font-medium">유효기간</span>을 지정하세요.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => addDraft({ label: "주간 프로모션", priority: 10, valid_from: new Date().toISOString().slice(0, 10) })}>
            <Sparkles className="size-4 mr-1" /> 프로모션 추가
          </Button>
          <Button size="sm" onClick={() => addDraft()}>
            <Plus className="size-4 mr-1" /> 단가 추가
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/40">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[160px]">규칙명</TableHead>
              <TableHead>유형</TableHead>
              <TableHead>상품</TableHead>
              <TableHead>모델</TableHead>
              <TableHead className="text-right min-w-[140px]">단가</TableHead>
              <TableHead>유효기간</TableHead>
              <TableHead className="text-center">활성</TableHead>
              <TableHead className="text-right">동작</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">등록된 인센티브 단가가 없습니다. '단가 추가' 버튼을 눌러 시작하세요.</TableCell></TableRow>
            ) : rows.map((row) => (
              <TableRow key={row.id} className={row.dirty ? "bg-amber-500/5" : ""}>
                <TableCell>
                  <Input value={row.label} onChange={(e) => updateDraft(row.id!, { label: e.target.value })} className="h-9" />
                </TableCell>
                <TableCell>
                  <Select value={row.match_sale_type ?? NONE} onValueChange={(v) => updateDraft(row.id!, { match_sale_type: v === NONE ? null : v })}>
                    <SelectTrigger className="h-9 w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>전체</SelectItem>
                      {SALE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={row.match_product ?? NONE} onValueChange={(v) => updateDraft(row.id!, { match_product: v === NONE ? null : v })}>
                    <SelectTrigger className="h-9 w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>전체</SelectItem>
                      {PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={row.match_model ?? NONE} onValueChange={(v) => updateDraft(row.id!, { match_model: v === NONE ? null : v })}>
                    <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>전체</SelectItem>
                      {models.map((m) => <SelectItem key={m.id} value={m.model_name}>{m.model_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <MoneyInput value={row.amount} onChange={(v) => updateDraft(row.id!, { amount: v })} className="h-9" />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Input type="date" value={row.valid_from ?? ""} onChange={(e) => updateDraft(row.id!, { valid_from: e.target.value || null })} className="h-9 w-[140px]" />
                    <span className="text-muted-foreground">~</span>
                    <Input type="date" value={row.valid_to ?? ""} onChange={(e) => updateDraft(row.id!, { valid_to: e.target.value || null })} className="h-9 w-[140px]" />
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Switch checked={row.active} onCheckedChange={(v) => updateDraft(row.id!, { active: v })} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {(row.dirty || row.isNew) && (
                      <Button size="sm" variant="default" onClick={() => saveRow(row)} className="h-8">
                        <Save className="size-3.5 mr-1" /> 저장
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => deleteRow(row)} className="h-8 text-destructive hover:text-destructive">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="border-amber-500/40 text-amber-400"><Calendar className="size-3 mr-1" /> 유효기간 미설정 = 상시 적용</Badge>
        <Badge variant="outline">조건 미설정 = 모든 실적에 적용</Badge>
        <Badge variant="outline">중복 매칭 시 합산</Badge>
      </div>
    </Card>
  );
}
