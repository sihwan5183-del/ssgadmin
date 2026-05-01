import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { HeartHandshake, Trash2, Send, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFieldOptions } from "@/hooks/useFieldOptions";
import { toast } from "sonner";
import { formatPhone } from "@/lib/phoneFormat";

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
  carrier?: string | null;
  converted_at?: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);

const CARRIERS = [
  "SKT",
  "KT",
  "LGU+",
  "알뜰폰(SKT망)",
  "알뜰폰(KT망)",
  "알뜰폰(LGU+망)",
] as const;
const isOurCarrier = (c?: string | null) => c === "LGU+";

const RegularInputPage = () => {
  const { user } = useAuth();
  const { options: channelOptions } = useFieldOptions("channel");
  const [list, setList] = useState<Regular[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    channel: "",
    customer_name: "",
    carrier: "",
    phone: "",
    birth_date: "",
    manager: "",
    coupon_sent: false,
    converted: false,
    registered_date: today(),
    note: "",
  });

  const fetchList = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("regulars")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) toast.error("조회 실패: " + error.message);
    setList((data ?? []) as Regular[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchList();
  }, []);

  const reset = () =>
    setForm({
      channel: "",
      customer_name: "",
      carrier: "",
      phone: "",
      birth_date: "",
      manager: "",
      coupon_sent: false,
      converted: false,
      registered_date: today(),
      note: "",
    });

  const submit = async () => {
    if (!user) return toast.error("로그인이 필요합니다");
    if (!form.channel) return toast.error("채널을 선택해주세요");
    if (!form.customer_name.trim()) return toast.error("고객명을 입력해주세요");

    setSubmitting(true);
    const { error } = await supabase.from("regulars").insert({
      created_by: user.id,
      channel: form.channel,
      customer_name: form.customer_name.trim(),
      carrier: form.carrier || null,
      phone: form.phone || null,
      birth_date: form.birth_date || null,
      manager: form.manager || null,
      coupon_sent: form.coupon_sent,
      converted: form.converted,
      registered_date: form.registered_date,
      note: form.note || null,
    });
    setSubmitting(false);
    if (error) return toast.error("등록 실패: " + error.message);
    toast.success("단골 등록 완료");
    reset();
    fetchList();
  };

  const remove = async (id: string) => {
    if (!confirm("이 단골 기록을 삭제할까요?")) return;
    const { error } = await supabase.from("regulars").delete().eq("id", id);
    if (error) return toast.error("삭제 실패: " + error.message);
    toast.success("삭제되었습니다");
    fetchList();
  };

  const toggle = async (id: string, field: "coupon_sent" | "converted", value: boolean) => {
    const update = field === "coupon_sent" ? { coupon_sent: value } : { converted: value };
    const { error } = await supabase.from("regulars").update(update).eq("id", id);
    if (error) return toast.error("업데이트 실패: " + error.message);
    fetchList();
  };

  // 채널별 합계
  const totals = list.reduce<Record<string, number>>((acc, r) => {
    acc[r.channel] = (acc[r.channel] ?? 0) + 1;
    return acc;
  }, {});
  const couponCount = list.filter((r) => r.coupon_sent).length;
  const convertCount = list.filter((r) => r.converted).length;

  return (
    <>
      <Header
        title="단골 등록"
        subtitle="채널별로 단골 고객을 직접 등록하고 쿠폰·자사 전환 여부를 관리하세요"
      />

      {/* 요약 KPI */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-5 glass">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <HeartHandshake className="size-4 text-primary" />
            전체 단골
          </div>
          <div className="mt-2 text-3xl font-bold tabular-nums">
            {list.length}
            <span className="text-sm text-muted-foreground ml-1">명</span>
          </div>
        </Card>
        <Card className="p-5 glass">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Send className="size-4 text-blue-300" />
            쿠폰 발송
          </div>
          <div className="mt-2 text-3xl font-bold tabular-nums">
            {couponCount}
            <span className="text-sm text-muted-foreground ml-1">건</span>
          </div>
        </Card>
        <Card className="p-5 glass">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="size-4 text-pink-300" />
            자사 전환
          </div>
          <div className="mt-2 text-3xl font-bold tabular-nums">
            {convertCount}
            <span className="text-sm text-muted-foreground ml-1">건</span>
          </div>
        </Card>
        <Card className="p-5 glass">
          <div className="text-xs text-muted-foreground mb-2">최다 채널</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(totals)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([ch, n]) => (
                <Badge key={ch} variant="outline" className="text-xs">
                  {ch} {n}
                </Badge>
              ))}
            {Object.keys(totals).length === 0 && (
              <span className="text-xs text-muted-foreground">데이터 없음</span>
            )}
          </div>
        </Card>
      </section>

      {/* 입력 폼 */}
      <Card className="p-6 glass mb-6">
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <HeartHandshake className="size-4 text-primary" />새 단골 등록
        </h3>

        {/* 핵심 입력행: 채널 → 통신사 → 성함 → 연락처 → 자사전환 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">채널 *</Label>
            <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
              <SelectTrigger><SelectValue placeholder="채널 선택" /></SelectTrigger>
              <SelectContent>
                {channelOptions.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">통신사 *</Label>
            <Select value={form.carrier} onValueChange={(v) => setForm({ ...form, carrier: v })}>
              <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
              <SelectContent>
                {CARRIERS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">성함 *</Label>
            <Input
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              placeholder="홍길동"
            />
          </div>
          <div className="md:col-span-3 space-y-1.5">
            <Label className="text-xs">연락처</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
              placeholder={form.carrier ? "010-0000-0000" : "통신사를 먼저 선택"}
              disabled={!form.carrier}
              type="tel"
              inputMode="numeric"
              maxLength={13}
            />
          </div>
          <div className="md:col-span-3 space-y-1.5">
            <Label className="text-xs">자사 전환</Label>
            <div
              className={`h-10 px-3 rounded-md border flex items-center gap-2 transition-colors ${
                form.converted
                  ? "bg-emerald-500/10 border-emerald-500/40"
                  : "bg-background/40 border-border/50"
              }`}
            >
              <Switch
                checked={form.converted}
                onCheckedChange={(v) => setForm({ ...form, converted: v })}
              />
              <span className="text-xs text-muted-foreground">
                {form.converted ? "전환 완료 ✓" : "타사 → 자사 가입 시 ON"}
              </span>
            </div>
          </div>
        </div>

        {/* 보조 입력행 */}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">생년월일</Label>
            <Input
              value={form.birth_date}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
              placeholder="900101"
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">담당자</Label>
            <Input
              value={form.manager}
              onChange={(e) => setForm({ ...form, manager: e.target.value })}
              placeholder="담당 직원"
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">등록일</Label>
            <Input
              type="date"
              value={form.registered_date}
              onChange={(e) => setForm({ ...form, registered_date: e.target.value })}
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">쿠폰 발송</Label>
            <div className="h-10 px-3 rounded-md border border-border/50 bg-background/40 flex items-center gap-2">
              <Switch
                checked={form.coupon_sent}
                onCheckedChange={(v) => setForm({ ...form, coupon_sent: v })}
              />
              <span className="text-xs text-muted-foreground">
                {form.coupon_sent ? "발송됨" : "미발송"}
              </span>
            </div>
          </div>
          <div className="md:col-span-4 space-y-1.5">
            <Label className="text-xs">메모</Label>
            <Input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="고객 특이사항, 관심 상품 등"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={reset}>초기화</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "등록 중..." : "단골 등록"}
          </Button>
        </div>
      </Card>

      {/* 등록된 단골 리스트 */}
      <Card className="p-6 glass">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">등록된 단골 목록</h3>
          <Badge variant="outline">{list.length}건</Badge>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">불러오는 중...</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            아직 등록된 단골이 없습니다. 위에서 첫 단골을 등록해주세요.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border/40">
                <tr>
                  <th className="text-left py-2 px-2">등록일</th>
                  <th className="text-left py-2 px-2">채널</th>
                  <th className="text-left py-2 px-2">고객명</th>
                  <th className="text-left py-2 px-2">통신사</th>
                  <th className="text-left py-2 px-2">전화번호</th>
                  <th className="text-left py-2 px-2">담당자</th>
                  <th className="text-center py-2 px-2">쿠폰</th>
                  <th className="text-center py-2 px-2">전환</th>
                  <th className="text-left py-2 px-2">메모</th>
                  <th className="text-right py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-b border-border/20 hover:bg-accent/20 transition-colors ${
                      r.converted ? "bg-emerald-500/[0.07]" : ""
                    }`}
                  >
                    <td className="py-2 px-2 tabular-nums text-xs">{r.registered_date}</td>
                    <td className="py-2 px-2">
                      <Badge variant="outline" className="text-xs">{r.channel}</Badge>
                    </td>
                    <td className="py-2 px-2 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span>{r.customer_name}</span>
                        {r.converted && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                            title={r.converted_at ? `전환일: ${new Date(r.converted_at).toLocaleDateString("ko-KR")}` : "전환 완료"}
                          >
                            ✓ 전환완료
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      {r.carrier ? (
                        <Badge
                          variant={isOurCarrier(r.carrier) ? "default" : "outline"}
                          className={`text-[10px] ${isOurCarrier(r.carrier) ? "" : "border-amber-500/50 text-amber-600"}`}
                        >
                          {!isOurCarrier(r.carrier) && "🔁 "}{r.carrier}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-muted-foreground tabular-nums">{r.phone ?? "-"}</td>
                    <td className="py-2 px-2 text-muted-foreground">{r.manager ?? "-"}</td>
                    <td className="py-2 px-2 text-center">
                      <Switch
                        checked={r.coupon_sent}
                        onCheckedChange={(v) => toggle(r.id, "coupon_sent", v)}
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Switch
                        checked={r.converted}
                        onCheckedChange={(v) => toggle(r.id, "converted", v)}
                      />
                    </td>
                    <td className="py-2 px-2 text-xs text-muted-foreground max-w-[200px] truncate">
                      {r.note ?? "-"}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(r.id)}
                        className="size-7"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
};

export default RegularInputPage;
