import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus, Search, Trash2, Pencil, X } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStaff } from "@/hooks/useDashboardStaff";
import { useStaffNames } from "@/hooks/useStaffNames";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Row = {
  id: string;
  change_date: string;
  manager: string | null;
  customer_join_number: string | null;
  customer_name: string | null;
  prev_fee: number;
  prev_select_discount: boolean;
  new_fee: number;
  new_select_discount: boolean;
  pure_upsell: number;
  final_upsell: number;
  offer_provided: boolean;
  note: string | null;
  created_by: string;
};

const todayStr = () => format(new Date(), "yyyy-MM-dd");
const won = (n: number) => `${Math.round(n).toLocaleString()}원`;
const onlyDigits = (s: string, max: number) => s.replace(/[^0-9]/g, "").slice(0, max);
const calcDiscounted = (fee: number, on: boolean) => (on ? fee * 0.75 : fee);

export default function CustomProposalsPage() {
  const { user } = useAuth();
  const { staff } = useDashboardStaff();
  const { resolve: resolveName } = useStaffNames();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // form state
  const [editId, setEditId] = useState<string | null>(null);
  const [date, setDate] = useState<Date>(new Date());
  const [manager, setManager] = useState<string>("");
  const [joinNumber, setJoinNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [prevFee, setPrevFee] = useState("");
  const [prevDiscount, setPrevDiscount] = useState(false);
  const [newFee, setNewFee] = useState("");
  const [newDiscount, setNewDiscount] = useState(false);
  const [offerProvided, setOfferProvided] = useState(false);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  // 기본 담당자 = 로그인 사용자 이름
  useEffect(() => {
    if (manager || !user) return;
    const me = staff.find((s) => s.user_id === user.id);
    if (me?.display_name) setManager(me.display_name);
  }, [user, staff, manager]);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("custom_proposals")
      .select("*")
      .order("change_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      toast.error("목록을 불러오지 못했어요");
    } else {
      setRows((data ?? []) as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const prevFeeN = Number(prevFee || 0);
  const newFeeN = Number(newFee || 0);
  const prevFinal = calcDiscounted(prevFeeN, prevDiscount);
  const newFinal = calcDiscounted(newFeeN, newDiscount);
  const pureUpsell = newFeeN - prevFeeN;
  const finalUpsell = newFinal - prevFinal;

  const resetForm = () => {
    setEditId(null);
    setDate(new Date());
    setJoinNumber("");
    setCustomerName("");
    setPrevFee("");
    setPrevDiscount(false);
    setNewFee("");
    setNewDiscount(false);
    setOfferProvided(false);
    setMemo("");
  };

  const save = async () => {
    if (!user) return;
    if (!customerName.trim()) {
      toast.error("고객명을 입력해주세요");
      return;
    }
    setSaving(true);
    const payload = {
      change_date: format(date, "yyyy-MM-dd"),
      manager: manager || null,
      customer_join_number: joinNumber || null,
      customer_name: customerName.trim(),
      prev_fee: prevFeeN,
      prev_select_discount: prevDiscount,
      new_fee: newFeeN,
      new_select_discount: newDiscount,
      pure_upsell: pureUpsell,
      final_upsell: finalUpsell,
      offer_provided: offerProvided,
      note: memo.trim() || null,
    };
    const { error } = editId
      ? await supabase.from("custom_proposals").update(payload).eq("id", editId)
      : await supabase.from("custom_proposals").insert({ ...payload, created_by: user.id });
    setSaving(false);
    if (error) {
      toast.error(`저장 실패: ${error.message}`);
      return;
    }
    toast.success(editId ? "수정되었습니다" : "등록되었습니다");
    resetForm();
    refresh();
  };

  const edit = (r: Row) => {
    setEditId(r.id);
    setDate(new Date(r.change_date));
    setManager(r.manager ?? "");
    setJoinNumber(r.customer_join_number ?? "");
    setCustomerName(r.customer_name ?? "");
    setPrevFee(String(r.prev_fee ?? ""));
    setPrevDiscount(!!r.prev_select_discount);
    setNewFee(String(r.new_fee ?? ""));
    setNewDiscount(!!r.new_select_discount);
    setOfferProvided(!!r.offer_provided);
    setMemo(r.note ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (id: string) => {
    if (!confirm("이 항목을 삭제할까요?")) return;
    const { error } = await supabase.from("custom_proposals").delete().eq("id", id);
    if (error) toast.error(`삭제 실패: ${error.message}`);
    else {
      toast.success("삭제되었습니다");
      refresh();
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const m = (r.manager ?? "").toLowerCase();
      const c = (r.customer_name ?? "").toLowerCase();
      const j = (r.customer_join_number ?? "").toLowerCase();
      return m.includes(q) || c.includes(q) || j.includes(q);
    });
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <Header title="맞춤제안 실적관리" subtitle="요금제 변경 업셀 실시간 계산 · 누적 실적 관리" />

      {/* 입력 폼 */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-semibold">
            {editId ? "맞춤제안 수정" : "신규 맞춤제안 등록"}
          </div>
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors",
              offerProvided ? "border-primary/40 bg-primary/10" : "border-border bg-muted/40",
            )}>
              <span className={cn(
                "text-xs font-semibold",
                offerProvided ? "text-primary" : "text-muted-foreground",
              )}>
                {offerProvided ? "오퍼 제공" : "오퍼 미제공"}
              </span>
              <Switch checked={offerProvided} onCheckedChange={setOfferProvided} />
            </div>
            {editId && (
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <X className="size-4 mr-1" /> 수정 취소
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-2">
            <Label>변경일</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {date ? format(date, "yyyy-MM-dd") : "날짜 선택"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>담당자</Label>
            <Select value={manager || undefined} onValueChange={(v) => setManager(v)}>
              <SelectTrigger>
                <SelectValue placeholder="담당자 선택" />
              </SelectTrigger>
              <SelectContent>
                {staff.map((s) => (
                  <SelectItem key={s.user_id} value={s.display_name}>
                    {s.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>고객가입번호 (숫자 최대 12자리)</Label>
            <Input
              inputMode="numeric"
              value={joinNumber}
              onChange={(e) => setJoinNumber(onlyDigits(e.target.value, 12))}
              placeholder="예: 123456789012"
            />
          </div>

          <div className="space-y-2">
            <Label>고객명</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="고객명"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* 기존 요금제 */}
          <Card className="p-4 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">기존 요금제</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">선택약정</span>
                <Switch checked={prevDiscount} onCheckedChange={setPrevDiscount} />
                <Badge variant={prevDiscount ? "default" : "secondary"} className="text-[10px]">
                  {prevDiscount ? "ON" : "OFF"}
                </Badge>
              </div>
            </div>
            <Input
              inputMode="numeric"
              value={prevFee}
              onChange={(e) => setPrevFee(onlyDigits(e.target.value, 10))}
              placeholder="예: 44000"
            />
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>원 요금</span>
              <span className="font-medium text-foreground">{won(prevFeeN)}</span>
            </div>
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>선약 반영</span>
              <span className={cn("font-semibold", prevDiscount && "text-primary")}>
                {won(prevFinal)}
              </span>
            </div>
          </Card>

          {/* 변경 요금제 */}
          <Card className="p-4 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">변경 요금제</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">선택약정</span>
                <Switch checked={newDiscount} onCheckedChange={setNewDiscount} />
                <Badge variant={newDiscount ? "default" : "secondary"} className="text-[10px]">
                  {newDiscount ? "ON" : "OFF"}
                </Badge>
              </div>
            </div>
            <Input
              inputMode="numeric"
              value={newFee}
              onChange={(e) => setNewFee(onlyDigits(e.target.value, 10))}
              placeholder="예: 55000"
            />
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>원 요금</span>
              <span className="font-medium text-foreground">{won(newFeeN)}</span>
            </div>
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>선약 반영</span>
              <span className={cn("font-semibold", newDiscount && "text-primary")}>
                {won(newFinal)}
              </span>
            </div>
          </Card>
        </div>

        {/* 실시간 업셀 결과 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 border-primary/30 bg-primary/5">
            <div className="text-xs text-muted-foreground">순수 요금 업셀 금액</div>
            <div className="text-xs text-muted-foreground mt-0.5">(변경 요금 − 기존 요금)</div>
            <div className={cn(
              "mt-2 text-2xl font-bold",
              pureUpsell > 0 ? "text-primary" : pureUpsell < 0 ? "text-destructive" : "",
            )}>
              {pureUpsell > 0 ? "+" : ""}{won(pureUpsell)}
            </div>
          </Card>
          <Card className="p-4 border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
            <div className="text-xs text-muted-foreground">선약 반영 최종 업셀 금액</div>
            <div className="text-xs text-muted-foreground mt-0.5">(신규 최종 − 기존 최종)</div>
            <div className={cn(
              "mt-2 text-2xl font-bold",
              finalUpsell > 0 ? "text-primary" : finalUpsell < 0 ? "text-destructive" : "",
            )}>
              {finalUpsell > 0 ? "+" : ""}{won(finalUpsell)}
            </div>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            <Plus className="size-4 mr-1" />
            {editId ? "수정 저장" : "등록"}
          </Button>
        </div>
      </Card>

      {/* 리스트 */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-semibold">맞춤제안 실적 리스트</div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="고객명 · 담당자 · 고객가입번호 검색"
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>변경일</TableHead>
                <TableHead>담당자</TableHead>
                <TableHead>고객명</TableHead>
                <TableHead>가입번호</TableHead>
                <TableHead className="text-right">기존요금(선약)</TableHead>
                <TableHead className="text-right">변경요금(선약)</TableHead>
                <TableHead className="text-right">순수업셀</TableHead>
                <TableHead className="text-right">최종업셀</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">불러오는 중…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">등록된 맞춤제안이 없습니다</TableCell></TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{r.change_date}</TableCell>
                  <TableCell className="whitespace-nowrap">{resolveName(r.manager, r.manager ?? "-")}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.customer_name ?? "-"}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">{r.customer_join_number ?? "-"}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {won(r.prev_fee)}{" "}
                    <Badge variant={r.prev_select_discount ? "default" : "secondary"} className="text-[9px] ml-1">
                      {r.prev_select_discount ? "선약" : "일반"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {won(r.new_fee)}{" "}
                    <Badge variant={r.new_select_discount ? "default" : "secondary"} className="text-[9px] ml-1">
                      {r.new_select_discount ? "선약" : "일반"}
                    </Badge>
                  </TableCell>
                  <TableCell className={cn("text-right whitespace-nowrap font-semibold",
                    r.pure_upsell > 0 ? "text-primary" : r.pure_upsell < 0 ? "text-destructive" : "")}>
                    {r.pure_upsell > 0 ? "+" : ""}{won(r.pure_upsell)}
                  </TableCell>
                  <TableCell className={cn("text-right whitespace-nowrap font-semibold",
                    r.final_upsell > 0 ? "text-primary" : r.final_upsell < 0 ? "text-destructive" : "")}>
                    {r.final_upsell > 0 ? "+" : ""}{won(r.final_upsell)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => edit(r)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}