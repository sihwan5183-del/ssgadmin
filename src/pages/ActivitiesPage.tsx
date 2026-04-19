import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { SaleSearchPanel } from "@/components/sales/SaleSearchPanel";
import { useViewScope } from "@/contexts/ViewScopeContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  FileWarning, Search, Upload, Phone, User, Smartphone, AlertTriangle, ListChecks,
  ClipboardList, CheckCircle2, Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SaleDocuments } from "@/components/sales/SaleDocuments";
import { PendingItemsEditor } from "@/components/sales/PendingItemsEditor";
import { toast } from "sonner";

interface SaleLite {
  id: string;
  customer_name: string | null;
  phone: string | null;
  device_serial: string | null;
  device_model: string | null;
  channel: string | null;
  open_date: string | null;
  manager: string | null;
  approval_status: string | null;
  doc_count?: number;
}

const PAGE_SIZE = 100;

function MissingDocsSection() {
  const [rows, setRows] = useState<SaleLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SaleLite | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: sales, error } = await supabase
      .from("sales")
      .select(
        "id, customer_name, phone, device_serial, device_model, channel, open_date, manager, approval_status",
      )
      .order("open_date", { ascending: false, nullsFirst: false })
      .limit(500);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const ids = (sales ?? []).map((s) => s.id);
    if (ids.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data: docs } = await supabase
      .from("sale_documents")
      .select("sale_id")
      .in("sale_id", ids);

    const counts = new Map<string, number>();
    (docs ?? []).forEach((d: any) => counts.set(d.sale_id, (counts.get(d.sale_id) ?? 0) + 1));

    const missing = (sales ?? [])
      .map((s: any) => ({ ...s, doc_count: counts.get(s.id) ?? 0 }))
      .filter((s) => (s.doc_count ?? 0) === 0)
      .slice(0, PAGE_SIZE);

    setRows(missing);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.customer_name, r.phone, r.device_serial, r.device_model, r.channel, r.manager]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, search]);

  return (
    <div className="space-y-5">
      <Card className="p-5 glass border-warning/30">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-warning/15 grid place-items-center">
            <AlertTriangle className="size-5 text-warning" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">정산 누락 방지를 위한 서류 첨부 알림</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              아래 실적은 가입 서류가 1건도 업로드되지 않았습니다. 클릭하여 즉시 업로드하세요.
            </div>
          </div>
          <Badge variant="outline" className="border-warning/40 text-warning bg-warning/10">
            {filtered.length}건 미첨부
          </Badge>
        </div>
      </Card>

      <div>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="고객명 · 전화번호 · IMEI · 매체 검색…"
            className="h-10 pl-9 bg-input/60"
          />
        </div>
      </div>

      <Card className="glass border-border/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2.5">고객</th>
                <th className="text-left px-3 py-2.5">연락처</th>
                <th className="text-left px-3 py-2.5">단말기 / IMEI</th>
                <th className="text-left px-3 py-2.5">개통일</th>
                <th className="text-left px-3 py-2.5">매체 / 담당</th>
                <th className="text-left px-3 py-2.5">상태</th>
                <th className="text-right px-3 py-2.5">조치</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">불러오는 중…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">
                  🎉 모든 실적에 가입 서류가 첨부되어 있습니다
                </td></tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border/30 hover:bg-muted/20">
                    <td className="px-3 py-2.5 font-medium flex items-center gap-1.5">
                      <User className="size-3 text-muted-foreground" />
                      {r.customer_name ?? "(이름없음)"}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Phone className="size-3" />{r.phone ?? "-"}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <div className="flex items-center gap-1"><Smartphone className="size-3 text-muted-foreground" />{r.device_model ?? "-"}</div>
                      <div className="text-muted-foreground font-mono text-[10px]">{r.device_serial ?? "-"}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs">{r.open_date ?? "-"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {r.channel ?? "-"} / {r.manager ?? "-"}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className="text-[10px]">
                        {r.approval_status ?? "승인대기"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelected(r)}>
                        <Upload className="size-3.5 mr-1" /> 서류 업로드
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!selected} onOpenChange={(v) => !v && (setSelected(null), load())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileWarning className="size-4 text-warning" />
              가입 서류 업로드 — {selected?.customer_name ?? "고객"}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <SaleDocuments
              saleId={selected.id}
              saleMeta={{
                open_date: selected.open_date,
                customer_name: selected.customer_name,
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ActivitiesPage = () => {
  const { scope } = useViewScope();

  return (
    <>
      <Header
        title="활동 관리"
        subtitle={scope === "personal" ? "내가 등록한 실적·서류 첨부 현황" : "팀 전체 실적·서류 첨부 현황"}
      />

      <Tabs defaultValue="search" className="space-y-5">
        <TabsList>
          <TabsTrigger value="search" className="gap-2">
            <ListChecks className="size-4" /> 실적 검색·관리
          </TabsTrigger>
          <TabsTrigger value="missing-docs" className="gap-2">
            <FileWarning className="size-4" /> 서류 미첨부
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search">
          <SaleSearchPanel />
        </TabsContent>

        <TabsContent value="missing-docs">
          <MissingDocsSection />
        </TabsContent>
      </Tabs>
    </>
  );
};

export default ActivitiesPage;
