import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, PlusCircle, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFieldOptions } from "@/hooks/useFieldOptions";
import { toast } from "sonner";

interface AdSpendRow {
  id: string;
  created_by: string;
  spend_date: string;
  spend_month: string | null;
  media: string;
  channel: string | null;
  amount: number;
  campaign: string | null;
  note: string | null;
}

const formatKRW = (n: number) =>
  new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(n);

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AdSpendPage() {
  const { user } = useAuth();
  const { options: MEDIA_OPTIONS } = useFieldOptions("media");
  const { options: CHANNELS } = useFieldOptions("channel");
  const [rows, setRows] = useState<AdSpendRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    spend_date: todayISO(),
    media: "",
    channel: "",
    amount: "",
    campaign: "",
    note: "",
  });

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ad_spend")
      .select("*")
      .order("spend_date", { ascending: false })
      .limit(100);
    if (error) toast.error("불러오기 실패: " + error.message);
    else setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const totals = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const byMedia = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.media] = (acc[r.media] ?? 0) + Number(r.amount || 0);
      return acc;
    }, {});
    return { total, byMedia };
  }, [rows]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.media || !form.amount || !form.spend_date) {
      toast.error("집행일·매체·금액은 필수입니다");
      return;
    }
    setSaving(true);
    const payload = {
      created_by: user.id,
      spend_date: form.spend_date,
      spend_month: form.spend_date.slice(0, 7),
      media: form.media,
      channel: form.channel || null,
      amount: Number(form.amount.replace(/[^0-9.-]/g, "")) || 0,
      campaign: form.campaign || null,
      note: form.note || null,
    };
    const { error } = await supabase.from("ad_spend").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("저장 실패: " + error.message);
      return;
    }
    toast.success("광고비가 저장되었습니다");
    setForm({ spend_date: todayISO(), media: "", channel: "", amount: "", campaign: "", note: "" });
    fetchRows();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 광고비 내역을 삭제할까요?")) return;
    const { error } = await supabase.from("ad_spend").delete().eq("id", id);
    if (error) toast.error("삭제 실패: " + error.message);
    else {
      toast.success("삭제되었습니다");
      fetchRows();
    }
  };

  return (
    <div>
      <Header
        title="광고비 입력"
        subtitle="매체별 광고 집행 금액을 기록하면 지출/ROI 대시보드에 자동 반영됩니다"
        showScopeToggle={false}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-5 glass">
          <div className="text-xs text-muted-foreground">전체 광고비 누적</div>
          <div className="mt-2 text-2xl font-bold text-gradient">{formatKRW(totals.total)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">최근 100건 기준</div>
        </Card>
        <Card className="p-5 glass lg:col-span-2">
          <div className="text-xs text-muted-foreground mb-3">매체별 집행 합계</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(totals.byMedia).length === 0 && (
              <span className="text-sm text-muted-foreground">아직 데이터가 없습니다</span>
            )}
            {Object.entries(totals.byMedia)
              .sort((a, b) => b[1] - a[1])
              .map(([m, v]) => (
                <Badge key={m} variant="outline" className="text-xs">
                  {m} · <span className="ml-1 font-semibold text-foreground">{formatKRW(v)}</span>
                </Badge>
              ))}
          </div>
        </Card>
      </div>

      <Card className="p-6 glass mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Megaphone className="size-4 text-primary" />
          <h3 className="font-semibold">신규 광고비 등록</h3>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label>집행일 *</Label>
            <Input
              type="date"
              value={form.spend_date}
              onChange={(e) => setForm({ ...form, spend_date: e.target.value })}
            />
          </div>
          <div>
            <Label>매체 *</Label>
            <Select value={form.media} onValueChange={(v) => setForm({ ...form, media: v })}>
              <SelectTrigger>
                <SelectValue placeholder="매체 선택" />
              </SelectTrigger>
              <SelectContent>
                {MEDIA_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>인입 경로 (선택)</Label>
            <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
              <SelectTrigger>
                <SelectValue placeholder="해당 채널" />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>금액 (₩) *</Label>
            <Input
              inputMode="numeric"
              placeholder="예: 500000"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Label>캠페인명</Label>
            <Input
              placeholder="예: 11월 신규개통 프로모션"
              value={form.campaign}
              onChange={(e) => setForm({ ...form, campaign: e.target.value })}
            />
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <Label>메모</Label>
            <Textarea
              rows={2}
              placeholder="집행 채널 세부, 소재, 타겟 등"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
          <div className="md:col-span-2 lg:col-span-3 flex justify-end">
            <Button type="submit" disabled={saving} className="gap-2">
              <PlusCircle className="size-4" />
              {saving ? "저장 중..." : "광고비 저장"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6 glass">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">최근 광고비 내역</h3>
          <span className="text-xs text-muted-foreground">{rows.length}건</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border/50">
              <tr>
                <th className="text-left py-2 pr-3">집행일</th>
                <th className="text-left py-2 pr-3">매체</th>
                <th className="text-left py-2 pr-3">인입경로</th>
                <th className="text-left py-2 pr-3">캠페인</th>
                <th className="text-right py-2 pr-3">금액</th>
                <th className="text-right py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    불러오는 중...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    등록된 광고비가 없습니다
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/30 hover:bg-muted/30">
                    <td className="py-2 pr-3">{r.spend_date}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline" className="text-xs">{r.media}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.channel ?? "-"}</td>
                    <td className="py-2 pr-3 text-muted-foreground truncate max-w-[240px]">
                      {r.campaign ?? "-"}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono font-semibold text-expense">
                      {formatKRW(Number(r.amount))}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {user?.id === r.created_by && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(r.id)}
                          className="size-8"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
