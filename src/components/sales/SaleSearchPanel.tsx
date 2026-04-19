import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Edit3, FileText, History, Save, Phone, User, Smartphone, Lock } from "lucide-react";
import { toast } from "sonner";
import { SaleDocuments } from "./SaleDocuments";
import { SaleAuditLog } from "./SaleAuditLog";
import { useSearchParams } from "react-router-dom";

interface SaleHit {
  id: string;
  created_by: string;
  customer_name: string | null;
  phone: string | null;
  device_serial: string | null;
  device_model: string | null;
  channel: string | null;
  product: string | null;
  rate_plan: string | null;
  status: string | null;
  open_date: string | null;
  manager: string | null;
  unit_price: number | null;
  net_fee: number | null;
  note: string | null;
}

const EDITABLE_FIELDS: Array<{ key: keyof SaleHit; label: string; type?: string }> = [
  { key: "customer_name", label: "고객명" },
  { key: "phone", label: "전화번호" },
  { key: "device_model", label: "단말기 모델" },
  { key: "device_serial", label: "단말기 일련번호" },
  { key: "channel", label: "채널" },
  { key: "product", label: "상품" },
  { key: "rate_plan", label: "요금제" },
  { key: "status", label: "상태" },
  { key: "manager", label: "담당자" },
  { key: "open_date", label: "개통일", type: "date" },
  { key: "unit_price", label: "단가", type: "number" },
  { key: "net_fee", label: "순수익", type: "number" },
  { key: "note", label: "메모" },
];

export const SaleSearchPanel = () => {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SaleHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SaleHit | null>(null);
  const [editForm, setEditForm] = useState<Partial<SaleHit>>({});
  const [saving, setSaving] = useState(false);

  const canEdit = useMemo(() => {
    if (!selected || !user) return false;
    return isAdmin || selected.created_by === user.id;
  }, [selected, user, isAdmin]);

  const search = async (override?: string) => {
    const term = (override ?? q).trim();
    if (!term) {
      setResults([]);
      return;
    }
    setSearching(true);
    const like = `%${term}%`;
    const { data, error } = await supabase
      .from("sales")
      .select(
        "id, created_by, customer_name, phone, device_serial, device_model, channel, product, rate_plan, status, open_date, manager, unit_price, net_fee, note",
      )
      .or(`customer_name.ilike.${like},phone.ilike.${like},device_serial.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(50);
    setSearching(false);
    if (error) return toast.error(error.message);
    setResults((data ?? []) as SaleHit[]);
  };

  // URL ?sale=ID로 들어왔을 때 자동 오픈 (알림에서 진입)
  useEffect(() => {
    const id = params.get("sale");
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from("sales")
        .select(
          "id, created_by, customer_name, phone, device_serial, device_model, channel, product, rate_plan, status, open_date, manager, unit_price, net_fee, note",
        )
        .eq("id", id)
        .maybeSingle();
      if (data) openDetail(data as SaleHit);
      // URL 정리
      params.delete("sale");
      setParams(params, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = (sale: SaleHit) => {
    setSelected(sale);
    setEditForm(sale);
  };

  const saveEdit = async () => {
    if (!selected) return;
    if (!canEdit) return toast.error("수정 권한이 없습니다");
    const payload: Record<string, unknown> = {};
    EDITABLE_FIELDS.forEach(({ key }) => {
      if (editForm[key] !== selected[key]) payload[key as string] = editForm[key];
    });
    if (Object.keys(payload).length === 0) {
      toast.info("변경된 내용이 없습니다");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("sales")
      .update(payload as never)
      .eq("id", selected.id);
    setSaving(false);
    setSelected({ ...selected, ...editForm } as SaleHit);
    search();
  };

  return (
    <Card className="p-5 glass border-border/40 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Search className="size-4 text-primary-glow" />
        <h3 className="font-semibold">실적 검색 / 수정</h3>
        <span className="text-xs text-muted-foreground ml-2">
          고객명 · 전화번호 · 단말기 일련번호(IMEI)
        </span>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="검색어 입력 후 Enter…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          className="h-10 bg-input/60"
        />
        <Button onClick={() => search()} disabled={searching}>
          <Search className="size-4 mr-1.5" />
          {searching ? "검색 중…" : "검색"}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="mt-4 rounded-xl border border-border/40 overflow-hidden">
          <div className="px-3 py-2 bg-muted/40 text-xs text-muted-foreground flex items-center justify-between">
            <span>검색 결과 {results.length}건 (최근순)</span>
            <span>클릭하면 상세 / 수정</span>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-border/30">
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => openDetail(r)}
                className="w-full text-left px-3 py-2.5 hover:bg-muted/30 transition-colors flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <User className="size-3 text-muted-foreground" />
                    {r.customer_name ?? "(이름없음)"}
                    {r.status && (
                      <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1"><Phone className="size-3" />{r.phone ?? "-"}</span>
                    <span className="flex items-center gap-1"><Smartphone className="size-3" />{r.device_serial ?? "-"}</span>
                    <span>{r.open_date ?? "-"}</span>
                    <span>{r.channel ?? "-"} / {r.product ?? "-"}</span>
                  </div>
                </div>
                <Edit3 className="size-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 상세/수정 다이얼로그 */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              실적 상세
              {!canEdit && (
                <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                  <Lock className="size-3" /> 읽기 전용
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <Tabs defaultValue="edit">
              <TabsList>
                <TabsTrigger value="edit">
                  <Edit3 className="size-3.5 mr-1" /> 정보
                </TabsTrigger>
                <TabsTrigger value="docs">
                  <FileText className="size-3.5 mr-1" /> 가입 서류
                </TabsTrigger>
                <TabsTrigger value="audit">
                  <History className="size-3.5 mr-1" /> 변경 이력
                </TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="mt-4">
                <div className="grid grid-cols-2 gap-3">
                  {EDITABLE_FIELDS.map(({ key, label, type }) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{label}</Label>
                      <Input
                        type={type ?? "text"}
                        value={(editForm[key] as string | number | null) ?? ""}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            [key]:
                              type === "number"
                                ? e.target.value === ""
                                  ? null
                                  : Number(e.target.value)
                                : e.target.value,
                          })
                        }
                        disabled={!canEdit}
                      />
                    </div>
                  ))}
                </div>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setSelected(null)}>닫기</Button>
                  <Button onClick={saveEdit} disabled={!canEdit || saving}>
                    <Save className="size-4 mr-1.5" />
                    {saving ? "저장 중…" : "저장"}
                  </Button>
                </DialogFooter>
              </TabsContent>

              <TabsContent value="docs" className="mt-4">
                <SaleDocuments
                  saleId={selected.id}
                  saleMeta={{
                    open_date: selected.open_date,
                    customer_name: selected.customer_name,
                  }}
                  readOnly={!canEdit}
                />
              </TabsContent>

              <TabsContent value="audit" className="mt-4">
                <SaleAuditLog saleId={selected.id} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
