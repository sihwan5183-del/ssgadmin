import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Search, TrendingUp, Calendar as CalIcon, Users, AlertTriangle } from "lucide-react";
import { useSegPartners, useSegActivities, type SegPartner } from "@/hooks/useSegPartners";
import { PartnerFormDialog } from "@/components/seg/PartnerFormDialog";
import { PartnerDetailDrawer } from "@/components/seg/PartnerDetailDrawer";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, isBefore } from "date-fns";
import { useNavigate } from "react-router-dom";

const STATUS_LABEL: Record<string, string> = { active: "진행중", paused: "보류", ended: "종료" };
const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  paused: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  ended: "bg-muted text-muted-foreground",
};

export default function SegPartnersPage() {
  const { partners } = useSegPartners();
  const { activities } = useSegActivities();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [contractFilter, setContractFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<SegPartner | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    return partners.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (contractFilter !== "all" && p.contract_type !== contractFilter) return false;
      if (q.trim()) {
        const s = q.toLowerCase();
        return (
          p.company_name.toLowerCase().includes(s) ||
          (p.contact_name ?? "").toLowerCase().includes(s) ||
          (p.contact_phone ?? "").includes(s)
        );
      }
      return true;
    });
  }, [partners, q, statusFilter, contractFilter]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const today = format(now, "yyyy-MM-dd");

    const newThisMonth = partners.filter((p) =>
      p.contract_date && isWithinInterval(parseISO(p.contract_date), { start: monthStart, end: monthEnd })
    ).length;
    const active = partners.filter((p) => p.status === "active").length;
    const upcoming = activities.filter((a) => !a.is_completed && a.next_action_date && a.next_action_date >= today).length;
    const overdue = activities.filter((a) => !a.is_completed && a.next_action_date && a.next_action_date < today).length;
    return { newThisMonth, active, upcoming, overdue, total: partners.length };
  }, [partners, activities]);

  const contractTypes = useMemo(() => {
    const set = new Set(partners.map((p) => p.contract_type).filter(Boolean) as string[]);
    return Array.from(set);
  }, [partners]);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow">
            <Building2 className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">SEG. 활동 관리</h1>
            <p className="text-xs text-muted-foreground">B2B 파트너 · MOU · 외부 영업 활동을 한 곳에서 관리합니다.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/seg-calendar")}>
            <CalIcon className="size-4 mr-1" /> 영업 캘린더
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4 mr-1" /> 신규 업체
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatBox icon={Users} label="전체 업체" value={stats.total} />
        <StatBox icon={TrendingUp} label="이번 달 신규 계약" value={stats.newThisMonth} tone="success" />
        <StatBox icon={Building2} label="진행중 업체" value={stats.active} tone="primary" />
        <StatBox icon={CalIcon} label="예정 활동" value={stats.upcoming} tone="info" />
        <StatBox icon={AlertTriangle} label="기한 초과" value={stats.overdue} tone="danger" />
      </div>

      <Card className="p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="업체명, 담당자, 연락처 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="active">진행중</SelectItem>
            <SelectItem value="paused">보류</SelectItem>
            <SelectItem value="ended">종료</SelectItem>
          </SelectContent>
        </Select>
        <Select value={contractFilter} onValueChange={setContractFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 계약유형</SelectItem>
            {contractTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.length === 0 && (
          <Card className="p-10 text-center text-sm text-muted-foreground col-span-full">
            등록된 업체가 없습니다. 우측 상단 [신규 업체] 버튼으로 추가하세요.
          </Card>
        )}
        {filtered.map((p) => {
          const partnerActs = activities.filter((a) => a.partner_id === p.id);
          const lastAct = partnerActs[0];
          const today = format(new Date(), "yyyy-MM-dd");
          const overdue = partnerActs.find((a) => !a.is_completed && a.next_action_date && a.next_action_date < today);
          return (
            <Card
              key={p.id}
              className="p-4 cursor-pointer hover:shadow-glow transition-shadow"
              onClick={() => { setSelected(p); setDrawerOpen(true); }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{p.company_name}</h3>
                    <Badge variant="outline" className={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                    <span>{p.business_type}</span>
                    {p.contract_type && <span>· {p.contract_type}</span>}
                    {p.contract_date && <span>· {p.contract_date}</span>}
                  </div>
                </div>
                {overdue && (
                  <Badge variant="destructive" className="shrink-0">기한 초과</Badge>
                )}
              </div>
              <div className="mt-3 text-xs space-y-0.5 text-muted-foreground">
                {p.contact_name && <div>담당: {p.contact_name}{p.contact_phone ? ` · ${p.contact_phone}` : ""}</div>}
                <div>활동: {partnerActs.length}건{lastAct ? ` · 최근 ${lastAct.activity_date}` : ""}</div>
              </div>
            </Card>
          );
        })}
      </div>

      <PartnerFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <PartnerDetailDrawer open={drawerOpen} onOpenChange={setDrawerOpen} partner={selected} />
    </div>
  );
}

function StatBox({ icon: Icon, label, value, tone = "muted" }: { icon: any; label: string; value: number; tone?: string }) {
  const cls = {
    primary: "from-primary/15 to-primary/5 text-primary",
    success: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
    info: "from-blue-500/15 to-blue-500/5 text-blue-600",
    danger: "from-rose-500/15 to-rose-500/5 text-rose-600",
    muted: "from-muted to-muted/40 text-muted-foreground",
  }[tone] ?? "from-muted to-muted/40 text-muted-foreground";
  return (
    <Card className="p-3 flex items-center gap-3">
      <div className={`size-10 rounded-xl bg-gradient-to-br ${cls} grid place-items-center`}>
        <Icon className="size-5" />
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-xl font-bold tabular-nums">{value}</div>
      </div>
    </Card>
  );
}