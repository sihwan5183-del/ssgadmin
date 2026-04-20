import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from "recharts";
import { HeartHandshake, Send, RefreshCw, Trash2, Search, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFieldOptions } from "@/hooks/useFieldOptions";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionBar } from "@/components/common/BulkActionBar";
import { BulkDeleteDialog } from "@/components/common/BulkDeleteDialog";
import { PurgeByFilterDialog, type PurgeFilter } from "@/components/common/PurgeByFilterDialog";
import { ShieldAlert } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileListCard } from "@/components/common/MobileListCard";

interface Regular {
  id: string;
  channel: string;
  customer_name: string;
  phone: string | null;
  birth_date: string | null;
  manager: string | null;
  coupon_sent: boolean;
  converted: boolean;
  registered_date: string;
  note: string | null;
  created_at: string;
  created_by: string;
}

const channelColors: Record<string, string> = {
  당근: "hsl(25 95% 60%)",
  플레이스: "hsl(155 70% 55%)",
  오프라인: "hsl(220 75% 60%)",
  모요: "hsl(270 90% 65%)",
  도그마루: "hsl(320 90% 65%)",
  지인소개: "hsl(195 90% 60%)",
  유닥: "hsl(45 95% 60%)",
  캠페인: "hsl(280 80% 70%)",
  SEG활동: "hsl(180 75% 55%)",
  기타: "hsl(220 15% 60%)",
};
const colorFor = (c: string) => channelColors[c] ?? "hsl(220 15% 60%)";
const today = () => new Date().toISOString().slice(0, 10);

const RegularsPage = () => {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const isMobile = useIsMobile();
  const [purgeOpen, setPurgeOpen] = useState(false);
  const { options: channelOptions } = useFieldOptions("channel");
  const [list, setList] = useState<Regular[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 등록 폼
  const [form, setForm] = useState({
    channel: "",
    customer_name: "",
    phone: "",
    birth_date: "",
    manager: "",
    coupon_sent: false,
    converted: false,
    registered_date: today(),
    note: "",
  });

  // 검색/필터
  const [q, setQ] = useState("");
  const [filterChannel, setFilterChannel] = useState<string>("all");
  const [filterConverted, setFilterConverted] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("regulars")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setList(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    if (!user) return toast.error("로그인이 필요합니다");
    if (!form.channel) return toast.error("채널을 선택하세요");
    if (!form.customer_name.trim()) return toast.error("고객명을 입력하세요");
    setSaving(true);
    const { error } = await supabase.from("regulars").insert({
      ...form,
      birth_date: form.birth_date || null,
      manager: form.manager || null,
      note: form.note || null,
      created_by: user.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("단골 등록 완료");
      setForm({
        channel: "",
        customer_name: "",
        phone: "",
        birth_date: "",
        manager: "",
        coupon_sent: false,
        converted: false,
        registered_date: today(),
        note: "",
      });
      load();
    }
    setSaving(false);
  };

  const remove = async (id: string) => {
    if (!confirm("삭제하시겠어요?")) return;
    const { error } = await supabase.from("regulars").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("삭제됨");
      load();
    }
  };

  const toggleField = async (id: string, field: "coupon_sent" | "converted", value: boolean) => {
    const update: Partial<Regular> = { [field]: value } as Partial<Regular>;
    const { error } = await supabase.from("regulars").update(update).eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  // 채널별 집계
  const channelStats = useMemo(() => {
    const map = new Map<string, { channel: string; count: number; converted: number; coupon: number }>();
    for (const r of list) {
      const key = r.channel || "기타";
      const cur = map.get(key) ?? { channel: key, count: 0, converted: 0, coupon: 0 };
      cur.count += 1;
      if (r.converted) cur.converted += 1;
      if (r.coupon_sent) cur.coupon += 1;
      map.set(key, cur);
    }
    return [...map.values()]
      .sort((a, b) => b.count - a.count)
      .map((d) => ({
        ...d,
        color: colorFor(d.channel),
        rate: d.count > 0 ? Math.round((d.converted / d.count) * 1000) / 10 : 0,
      }));
  }, [list]);

  const total = list.length;
  const totalConverted = list.filter((r) => r.converted).length;
  const totalCoupon = list.filter((r) => r.coupon_sent).length;
  const conversionRate = total > 0 ? Math.round((totalConverted / total) * 1000) / 10 : 0;
  const top = channelStats[0];

  // 필터된 리스트
  const filtered = useMemo(() => {
    return list.filter((r) => {
      if (filterChannel !== "all" && r.channel !== filterChannel) return false;
      if (filterConverted === "y" && !r.converted) return false;
      if (filterConverted === "n" && r.converted) return false;
      if (q) {
        const needle = q.toLowerCase();
        const hay = `${r.customer_name} ${r.phone ?? ""} ${r.manager ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [list, q, filterChannel, filterConverted]);

  // 다중 선택
  const bulk = useBulkSelection<string>(filtered.map((r) => r.id));
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const bulkDelete = async () => {
    setBulkBusy(true);
    const { error } = await supabase.from("regulars").delete().in("id", bulk.selectedIds);
    setBulkBusy(false);
    if (error) {
      toast.error("삭제 실패: " + error.message);
      return;
    }
    toast.success(`${bulk.selectedIds.length}건 삭제됨`);
    setBulkDeleteOpen(false);
    bulk.clear();
    load();
  };
  const bulkSendCoupon = async () => {
    const { error } = await supabase.from("regulars").update({ coupon_sent: true }).in("id", bulk.selectedIds);
    if (error) {
      toast.error("처리 실패: " + error.message);
      return;
    }
    toast.success(`${bulk.selectedIds.length}건 쿠폰 발송 처리`);
    bulk.clear();
    load();
  };
  return (
    <>
      <Header
        title="단골 관리"
        subtitle="채널별 단골 등록 현황 · 전환율 · 신규 등록"
      />

      {/* KPI */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="전체 단골" value={total} icon={HeartHandshake} color="from-primary/30 to-secondary/10 text-primary-glow" suffix="명" />
        <KpiCard
          label="최다 채널"
          value={top?.channel ?? "—"}
          icon={TrendingUp}
          color="from-orange-400/30 to-amber-500/10 text-orange-300"
          hint={top ? `${top.count}명 등록` : ""}
        />
        <KpiCard label="쿠폰 발송" value={totalCoupon} icon={Send} color="from-blue-400/30 to-cyan-500/10 text-blue-300" suffix="건" />
        <KpiCard
          label="자사 전환율"
          value={`${conversionRate}%`}
          icon={RefreshCw}
          color="from-pink-400/30 to-fuchsia-500/10 text-pink-300"
          hint={`${totalConverted}명 전환`}
        />
      </section>

      {/* 채널별 차트 + 전환율 */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        <div className="lg:col-span-3 glass rounded-2xl p-5">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <h4 className="text-base font-semibold tracking-tight">채널별 단골 등록</h4>
              <p className="text-xs text-muted-foreground mt-0.5">실제 등록된 단골을 채널 단위로 집계</p>
            </div>
            <span className="text-[11px] text-muted-foreground">단위: 명</span>
          </div>
          <div className="h-72">
            {channelStats.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">
                아직 등록된 단골이 없습니다
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelStats} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="channel" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--primary) / 0.08)" }}
                    contentStyle={{
                      background: "hsl(240 18% 8% / 0.95)",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number, name: string) => [`${v}${name === "count" ? "명" : "명"}`, name === "count" ? "등록" : "전환"]}
                  />
                  <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                    {channelStats.map((d) => <Cell key={d.channel} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 glass rounded-2xl p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="text-base font-semibold tracking-tight">채널별 전환율</h4>
            <span className="text-[11px] text-muted-foreground">자사 전환 / 등록</span>
          </div>
          <ul className="space-y-2">
            {channelStats.length === 0 && (
              <li className="text-sm text-muted-foreground text-center py-8">데이터 없음</li>
            )}
            {channelStats.map((c) => (
              <li key={c.channel} className="rounded-xl bg-card/40 border border-border/40 p-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                    <span className="font-medium">{c.channel}</span>
                  </div>
                  <span className="font-bold tabular-nums">
                    {c.rate}<span className="text-xs text-muted-foreground ml-1">%</span>
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, c.rate)}%`, background: c.color }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] mt-1.5 tabular-nums text-muted-foreground">
                  <span>{c.converted}/{c.count}명 전환</span>
                  <span>쿠폰 {c.coupon}건</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 등록 폼 */}
      <section className="glass rounded-2xl p-6 mb-6 shadow-card-elevated">
        <div className="flex items-center gap-2 mb-4">
          <HeartHandshake className="size-5 text-primary-glow" />
          <h3 className="text-lg font-semibold tracking-tight">새 단골 등록</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs">채널 *</Label>
            <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="채널 선택" /></SelectTrigger>
              <SelectContent>
                {channelOptions.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">고객명 *</Label>
            <Input
              className="mt-1.5"
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              placeholder="홍길동"
            />
          </div>
          <div>
            <Label className="text-xs">연락처</Label>
            <Input
              className="mt-1.5"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="010-0000-0000"
            />
          </div>
          <div>
            <Label className="text-xs">생년월일</Label>
            <Input
              className="mt-1.5"
              value={form.birth_date}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
              placeholder="YYYY-MM-DD"
            />
          </div>
          <div>
            <Label className="text-xs">담당자</Label>
            <Input
              className="mt-1.5"
              value={form.manager}
              onChange={(e) => setForm({ ...form, manager: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">등록일</Label>
            <Input
              type="date"
              className="mt-1.5"
              value={form.registered_date}
              onChange={(e) => setForm({ ...form, registered_date: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-3 mt-6">
            <Switch
              checked={form.coupon_sent}
              onCheckedChange={(v) => setForm({ ...form, coupon_sent: v })}
            />
            <Label className="text-sm">쿠폰 발송</Label>
          </div>
          <div className="flex items-center gap-3 mt-6">
            <Switch
              checked={form.converted}
              onCheckedChange={(v) => setForm({ ...form, converted: v })}
            />
            <Label className="text-sm">자사 전환</Label>
          </div>
          <div className="md:col-span-2 lg:col-span-4">
            <Label className="text-xs">메모</Label>
            <Textarea
              className="mt-1.5"
              rows={2}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={submit} disabled={saving} className="bg-gradient-primary">
            {saving ? "저장 중…" : "단골 등록"}
          </Button>
        </div>
      </section>

      {/* 검색/필터 + 리스트 */}
      <section className="glass rounded-2xl p-6 shadow-card-elevated">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">검색</Label>
            <div className="relative mt-1.5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="고객명 / 연락처 / 담당자"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
          <div className="w-44">
            <Label className="text-xs">채널</Label>
            <Select value={filterChannel} onValueChange={setFilterChannel}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {channelStats.map((c) => (
                  <SelectItem key={c.channel} value={c.channel}>{c.channel}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Label className="text-xs">전환여부</Label>
            <Select value={filterConverted} onValueChange={setFilterConverted}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="y">전환완료</SelectItem>
                <SelectItem value="n">미전환</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Badge variant="outline" className="border-primary/40 text-primary-glow ml-auto">
            {filtered.length}건
          </Badge>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => setPurgeOpen(true)}
              disabled={filtered.length === 0}
            >
              <ShieldAlert className="size-4 mr-1.5" /> 조건 전체삭제
            </Button>
          )}
        </div>

        <PurgeByFilterDialog
          open={purgeOpen}
          onOpenChange={setPurgeOpen}
          filter={{
            table: "regulars",
            filters: [
              ...(filterChannel !== "all" ? [{ column: "channel", op: "eq" as const, value: filterChannel }] : []),
              ...(filterConverted === "y" ? [{ column: "converted", op: "eq" as const, value: true }] : []),
              ...(filterConverted === "n" ? [{ column: "converted", op: "eq" as const, value: false }] : []),
            ],
            summary: `채널=${filterChannel === "all" ? "전체" : filterChannel} · 전환=${filterConverted === "all" ? "전체" : filterConverted === "y" ? "전환완료" : "미전환"}`,
          }}
          onDone={load}
        />

        {loading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">불러오는 중…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">조건에 맞는 단골이 없습니다</div>
        ) : isMobile ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Checkbox
                checked={bulk.allOnPageSelected}
                onCheckedChange={(v) => bulk.togglePage(!!v)}
                className="size-5"
              />
              <span>전체선택 · 총 {filtered.length}건</span>
            </div>
            {filtered.map((r) => (
              <MobileListCard
                key={r.id}
                selected={bulk.isSelected(r.id)}
                onToggleSelect={() => bulk.toggle(r.id)}
                title={
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{r.customer_name}</span>
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded-md"
                      style={{ background: `${colorFor(r.channel)}22`, color: colorFor(r.channel) }}
                    >
                      {r.channel}
                    </span>
                  </div>
                }
                meta={
                  <>
                    <span className="tabular-nums">{r.registered_date}</span>
                    {r.manager && <span>· {r.manager}</span>}
                    {r.phone && (
                      <a href={`tel:${r.phone}`} className="text-foreground/90" onClick={(e) => e.stopPropagation()}>
                        {r.phone}
                      </a>
                    )}
                  </>
                }
                actions={
                  <>
                    <label className="flex items-center gap-1.5 text-xs">
                      <Switch checked={r.coupon_sent} onCheckedChange={(v) => toggleField(r.id, "coupon_sent", v)} />
                      쿠폰
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <Switch checked={r.converted} onCheckedChange={(v) => toggleField(r.id, "converted", v)} />
                      전환
                    </label>
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)} className="h-10 ml-auto">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/40">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <Checkbox
                      checked={bulk.allOnPageSelected}
                      onCheckedChange={(v) => bulk.togglePage(!!v)}
                      aria-label="전체 선택"
                    />
                  </th>
                  <th className="text-left px-3 py-2">등록일</th>
                  <th className="text-left px-3 py-2">채널</th>
                  <th className="text-left px-3 py-2">고객명</th>
                  <th className="text-left px-3 py-2">연락처</th>
                  <th className="text-left px-3 py-2">담당자</th>
                  <th className="text-center px-3 py-2">쿠폰</th>
                  <th className="text-center px-3 py-2">전환</th>
                  <th className="text-right px-3 py-2"> </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className={`border-t border-border/30 hover:bg-muted/20 ${bulk.isSelected(r.id) ? "bg-primary/5" : ""}`}>
                    <td className="px-3 py-2">
                      <Checkbox checked={bulk.isSelected(r.id)} onCheckedChange={() => bulk.toggle(r.id)} />
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.registered_date}</td>
                    <td className="px-3 py-2">
                      <span
                        className="text-[11px] font-medium px-2 py-1 rounded-md"
                        style={{ background: `${colorFor(r.channel)}22`, color: colorFor(r.channel) }}
                      >
                        {r.channel}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium">{r.customer_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.phone ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.manager ?? "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <Switch checked={r.coupon_sent} onCheckedChange={(v) => toggleField(r.id, "coupon_sent", v)} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Switch checked={r.converted} onCheckedChange={(v) => toggleField(r.id, "converted", v)} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <BulkActionBar count={bulk.selectedCount} onClear={bulk.clear}>
        <Button size="sm" variant="outline" onClick={bulkSendCoupon}>
          <Send className="size-3.5 mr-1" /> 쿠폰 발송 처리
        </Button>
        <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
          <Trash2 className="size-3.5 mr-1" /> 선택 삭제
        </Button>
      </BulkActionBar>

      <BulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        count={bulk.selectedCount}
        itemLabel="명의 단골을 삭제하시겠습니까?"
        onConfirm={bulkDelete}
        loading={bulkBusy}
        confirmLabel="삭제"
      />
    </>
  );
};

const KpiCard = ({
  label, value, icon: Icon, color, suffix, hint,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  suffix?: string;
  hint?: string;
}) => (
  <Card className="glass rounded-2xl p-5 shadow-card-elevated border-border/40">
    <div className={`size-10 rounded-xl grid place-items-center bg-gradient-to-br ${color}`}>
      <Icon className="size-5" />
    </div>
    <div className="mt-4 text-sm text-muted-foreground">{label}</div>
    <div className="mt-1 text-2xl font-bold tabular-nums">
      {typeof value === "number" ? value.toLocaleString("ko-KR") : value}
      {suffix && <span className="text-sm text-muted-foreground ml-1">{suffix}</span>}
    </div>
    {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
  </Card>
);

export default RegularsPage;
