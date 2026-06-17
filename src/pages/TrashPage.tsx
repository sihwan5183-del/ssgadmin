import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { toast } from "sonner";
import { Trash2, RotateCcw, AlertTriangle } from "lucide-react";

type TrashItem = {
  id: string;
  table: "leads" | "sales";
  name: string;
  phone?: string;
  date: string;
  deleted_at: string;
  deleted_by: string;
  raw: any;
};

type Period = "4" | "5" | "6" | "7" | "all";

export default function TrashPage() {
  const { isSuperAdmin } = useSuperAdmin();
  const [leads, setLeads] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("all");
  const [tab, setTab] = useState<"leads" | "sales" | "all">("all");
  const [confirmText, setConfirmText] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: l }, { data: s }] = await Promise.all([
      supabase.from("leads").select("*").not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
      supabase.from("sales").select("*").not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
    ]);
    setLeads(l ?? []);
    setSales(s ?? []);
    setLoading(false);
  }

  const items = useMemo((): TrashItem[] => {
    const l: TrashItem[] = (leads ?? []).map((r) => ({
      id: r.id,
      table: "leads",
      name: r.customer_name ?? r.name ?? "-",
      phone: r.customer_phone ?? r.phone ?? "",
      date: r.registration_date ?? r.created_at?.slice(0, 10) ?? "",
      deleted_at: r.deleted_at,
      deleted_by: r.deleted_by ?? "-",
      raw: r,
    }));
    const s: TrashItem[] = (sales ?? []).map((r) => ({
      id: r.id,
      table: "sales",
      name: r.customer_name ?? r.manager ?? "-",
      phone: "",
      date: r.open_date ?? r.created_at?.slice(0, 10) ?? "",
      deleted_at: r.deleted_at,
      deleted_by: r.deleted_by ?? "-",
      raw: r,
    }));
    return [...l, ...s].sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));
  }, [leads, sales]);

  const filtered = useMemo(() => {
    return items.filter((r) => {
      if (tab !== "all" && r.table !== tab) return false;
      if (period === "all") return true;
      const m = r.date?.slice(5, 7) ?? r.deleted_at?.slice(5, 7);
      return m === period.padStart(2, "0");
    });
  }, [items, tab, period]);

  async function restore(item: TrashItem) {
    const { error } = await supabase
      .from(item.table)
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", item.id);
    if (error) return toast.error("복구 실패: " + error.message);
    toast.success("복구되었습니다");
    load();
  }

  async function hardDelete(item: TrashItem) {
    if (confirmText[item.id] !== "완전삭제") {
      toast.error("'완전삭제' 를 입력해야 합니다");
      return;
    }
    const { error } = await supabase.from(item.table).delete().eq("id", item.id);
    if (error) return toast.error("삭제 실패: " + error.message);
    toast.success("완전 삭제되었습니다");
    setConfirmText((prev) => { const n = { ...prev }; delete n[item.id]; return n; });
    load();
  }

  async function hardDeleteSelected() {
    if (!isSuperAdmin) return toast.error("권한이 없습니다");
    const ids = Array.from(selected);
    // 선택된 항목 중 모두 '완전삭제' 입력 확인
    const notConfirmed = ids.filter((id) => confirmText[id] !== "완전삭제");
    if (notConfirmed.length > 0) {
      toast.error(`${notConfirmed.length}건은 '완전삭제' 입력이 필요합니다`);
      return;
    }
    const leadIds = ids.filter((id) => filtered.find((r) => r.id === id)?.table === "leads");
    const saleIds = ids.filter((id) => filtered.find((r) => r.id === id)?.table === "sales");
    await Promise.all([
      leadIds.length > 0 ? supabase.from("leads").delete().in("id", leadIds) : Promise.resolve(),
      saleIds.length > 0 ? supabase.from("sales").delete().in("id", saleIds) : Promise.resolve(),
    ]);
    toast.success(`${ids.length}건 완전 삭제되었습니다`);
    setSelected(new Set());
    load();
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="휴지통" />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center text-muted-foreground">
            <AlertTriangle className="size-10 mx-auto mb-3 text-amber-500" />
            <div className="font-semibold">접근 권한이 없습니다</div>
            <div className="text-sm mt-1">휴지통은 대표 계정만 접근 가능합니다</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header title="휴지통" />
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2">
          <Trash2 className="size-5 text-red-500" />
          <h1 className="text-lg font-bold">휴지통</h1>
          <span className="text-xs text-muted-foreground ml-1">({filtered.length}건)</span>
        </div>

        {/* 필터 */}
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1">
            {(["all", "leads", "sales"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${tab === t ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:bg-muted/40"}`}
              >
                {t === "all" ? "전체" : t === "leads" ? "잠재고객" : "실적"}
              </button>
            ))}
          </div>
          <div className="flex gap-1 ml-2">
            {(["all", "4", "5", "6", "7"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${period === p ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:bg-muted/40"}`}
              >
                {p === "all" ? "전체" : `${p}월`}
              </button>
            ))}
          </div>
        </div>

        {/* 목록 */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="text-center py-10 text-muted-foreground text-sm">불러오는 중...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">휴지통이 비어있습니다</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b bg-muted/20">
                  {isSuperAdmin && <th className="py-2 px-3 w-8"></th>}
                  <th className="text-left py-2 px-3">구분</th>
                  <th className="text-left py-2 px-3">이름</th>
                  <th className="text-left py-2 px-3">날짜</th>
                  <th className="text-left py-2 px-3">삭제자</th>
                  <th className="text-left py-2 px-3">삭제일시</th>
                  <th className="text-center py-2 px-3">복구</th>
                  {isSuperAdmin && <th className="text-center py-2 px-3">완전삭제</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border/30 hover:bg-muted/10">
                    {isSuperAdmin && (
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={(e) => {
                            setSelected((prev) => {
                              const n = new Set(prev);
                              e.target.checked ? n.add(r.id) : n.delete(r.id);
                              return n;
                            });
                          }}
                        />
                      </td>
                    )}
                    <td className="py-2 px-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${r.table === "leads" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                        {r.table === "leads" ? "잠재" : "실적"}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-medium">{r.name}</td>
                    <td className="py-2 px-3 text-muted-foreground tabular-nums">{r.date}</td>
                    <td className="py-2 px-3 text-muted-foreground">{r.deleted_by}</td>
                    <td className="py-2 px-3 text-muted-foreground tabular-nums text-xs">
                      {r.deleted_at?.slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => restore(r)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                      >
                        <RotateCcw className="size-3" /> 복구
                      </button>
                    </td>
                    {isSuperAdmin && (
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            placeholder="완전삭제"
                            value={confirmText[r.id] ?? ""}
                            onChange={(e) => setConfirmText((prev) => ({ ...prev, [r.id]: e.target.value }))}
                            className="w-20 text-xs px-1.5 py-1 border rounded border-border/60"
                          />
                          <button
                            onClick={() => hardDelete(r)}
                            disabled={confirmText[r.id] !== "완전삭제"}
                            className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 disabled:opacity-30"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* 선택 완전삭제 (슈퍼어드민만) */}
        {isSuperAdmin && selected.size > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
            <AlertTriangle className="size-4 text-red-500" />
            <span className="text-sm text-red-700">{selected.size}건 선택됨 — 각 행에 '완전삭제' 입력 후 실행</span>
            <button
              onClick={hardDeleteSelected}
              className="ml-auto px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700"
            >
              선택 완전삭제
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
