import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Header } from "@/components/layout/Header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Upload, Zap, Trash2, Pencil, X, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFieldOptions } from "@/hooks/useFieldOptions";
import { cn } from "@/lib/utils";

type SaleRow = {
  id: string;
  created_by: string;
  seq: number | null;
  channel: string | null;
  moyo_excluded: boolean | null;
  manager: string | null;
  open_month: string | null;
  product: string | null;
  sale_type: string | null;
  open_method: string | null;
  status: string | null;
  open_date: string | null;
  customer_name: string | null;
  birth_date: string | null;
  phone: string | null;
  device_model: string | null;
  device_serial: string | null;
  usim_model: string | null;
  usim_serial: string | null;
  rate_plan: string | null;
  vas1: string | null;
  vas2: string | null;
  unit_price: number | null;
  vas_fee: number | null;
  voucher: string | null;
  voucher_returned: string | null;
  receivable_amount: number | null;
  receivable_paid: string | null;
  cash_open: boolean | null;
  distributor_amount: number | null;
  extra_subsidy: number | null;
  cash_support_amount: number | null;
  cash_bank: string | null;
  cash_account: string | null;
  cash_holder: string | null;
  net_fee: number | null;
  delivery_type: string | null;
  tracking_no: string | null;
  note: string | null;
  bundle: string | null;
};

const emptyForm: Partial<SaleRow> = {
  status: "개통완료",
  moyo_excluded: false,
  cash_open: false,
};

const InputPage = () => {
  const { user } = useAuth();
  const { options: CHANNELS } = useFieldOptions("channel");
  const { options: PRODUCTS } = useFieldOptions("product");
  const { options: SALE_TYPES } = useFieldOptions("sale_type");
  const { options: OPEN_METHODS } = useFieldOptions("open_method");
  const { options: STATUSES } = useFieldOptions("status");
  const { options: RATE_PLANS } = useFieldOptions("rate_plan");
  const { options: DELIVERY_TYPES } = useFieldOptions("delivery_type");
  const { options: BANKS } = useFieldOptions("bank");
  const [form, setForm] = useState<Partial<SaleRow>>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof SaleRow>(k: K, v: SaleRow[K] | undefined) =>
    setForm((f) => ({ ...f, [k]: v }));

  const num = (v: unknown) => {
    if (v === "" || v == null) return 0;
    const n = Number(String(v).replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const load = async () => {
    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast.error("목록 불러오기 실패", { description: error.message });
      return;
    }
    setRows((data ?? []) as SaleRow[]);
  };

  useEffect(() => {
    load();
  }, []);

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const payload = {
      ...form,
      created_by: user.id,
      unit_price: num(form.unit_price),
      vas_fee: num(form.vas_fee),
      receivable_amount: num(form.receivable_amount),
      distributor_amount: num(form.distributor_amount),
      extra_subsidy: num(form.extra_subsidy),
      cash_support_amount: num(form.cash_support_amount),
      net_fee: num(form.net_fee),
    };
    try {
      if (editingId) {
        const { error } = await supabase.from("sales").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("수정 완료");
      } else {
        const { error } = await supabase.from("sales").insert(payload);
        if (error) throw error;
        toast.success("판매 실적 저장 완료", { description: "대시보드에 즉시 반영됩니다." });
      }
      reset();
      load();
    } catch (err) {
      toast.error("저장 실패", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const onEdit = (r: SaleRow) => {
    setEditingId(r.id);
    setForm(r);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠어요?")) return;
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (error) return toast.error("삭제 실패", { description: error.message });
    toast.success("삭제 완료");
    load();
  };

  // === 엑셀 업로드 ===
  const handleFile = async (file: File) => {
    if (!user) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // 헤더가 2행에 있어 range:1로 두 번째 행을 헤더로 사용
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        range: 1,
        defval: null,
      });

      const pick = (r: Record<string, unknown>, ...keys: string[]) => {
        for (const k of keys) {
          if (r[k] !== undefined && r[k] !== null && r[k] !== "") return r[k];
        }
        return null;
      };
      const toNum = (v: unknown) => {
        if (v == null || v === "") return 0;
        const n = Number(String(v).replace(/[^\d.-]/g, ""));
        return Number.isFinite(n) ? n : 0;
      };
      const toBool = (v: unknown) => {
        if (typeof v === "boolean") return v;
        const s = String(v ?? "").trim();
        return ["O", "o", "Y", "y", "유", "예", "true", "1"].includes(s);
      };
      const toDate = (v: unknown): string | null => {
        if (!v) return null;
        if (typeof v === "number") {
          // Excel serial date
          const d = XLSX.SSF.parse_date_code(v);
          if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
        }
        const s = String(v).trim();
        // "04월 10일"
        const m = s.match(/(\d{1,2})월\s*(\d{1,2})일/);
        if (m) {
          const y = new Date().getFullYear();
          return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
        }
        const d = new Date(s);
        return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
      };

      const records = json
        .filter((r) => pick(r, "고객명", "인입경로", "담당자"))
        .map((r) => ({
          created_by: user.id,
          seq: pick(r, "번호", "No", "no") ? Number(pick(r, "번호", "No", "no")) : null,
          channel: pick(r, "인입경로") as string | null,
          moyo_excluded: toBool(pick(r, "모요\n미적용", "모요 미적용", "모요미적용")),
          manager: pick(r, "담당자") as string | null,
          open_month: pick(r, "개통년월") ? String(pick(r, "개통년월")) : null,
          product: pick(r, "가입상품") as string | null,
          sale_type: pick(r, "판매유형") as string | null,
          bundle: pick(r, "동판/번들") as string | null,
          open_method: pick(r, "개통방식") as string | null,
          status: (pick(r, "최종상태") as string) || "개통완료",
          open_date: toDate(pick(r, "개통일자")),
          customer_name: pick(r, "고객명") as string | null,
          birth_date: pick(r, "생년월일") ? String(pick(r, "생년월일")) : null,
          phone: pick(r, "연락처") as string | null,
          device_model: pick(r, "단말기") as string | null,
          device_serial: pick(r, "일련번호") ? String(pick(r, "일련번호")) : null,
          usim_model: pick(r, "USIM") as string | null,
          usim_serial: pick(r, "일련번호.1", "일련번호_1") ? String(pick(r, "일련번호.1", "일련번호_1")) : null,
          rate_plan: pick(r, "개통요금제") as string | null,
          vas1: pick(r, "부가서비스.1", "부가서비스1") as string | null,
          vas2: pick(r, "부가서비스.2", "부가서비스2") as string | null,
          unit_price: toNum(pick(r, "단가표 기준", "단가표기준")),
          vas_fee: toNum(pick(r, "VAS 수수료", "VAS수수료")),
          voucher: pick(r, "상품권\n*반납시 작성", "상품권") ? String(pick(r, "상품권\n*반납시 작성", "상품권")) : null,
          voucher_returned: pick(r, "반납\n유/무", "반납 유/무", "반납유무") as string | null,
          receivable_amount: toNum(pick(r, "금액")),
          receivable_paid: pick(r, "입금\n유/무", "입금 유/무") as string | null,
          cash_open: toBool(pick(r, "현금개통")),
          distributor_amount: toNum(pick(r, "유통망")),
          extra_subsidy: toNum(pick(r, "추가지원금")),
          cash_support_amount: toNum(pick(r, "입금금액")),
          cash_bank: pick(r, "은행") as string | null,
          cash_account: pick(r, "입금계좌") as string | null,
          cash_holder: pick(r, "예금주") as string | null,
          net_fee: toNum(pick(r, "수수료")),
          delivery_type: pick(r, "발송유형") as string | null,
          tracking_no: pick(r, "운송장") ? String(pick(r, "운송장")) : null,
          note: pick(r, "특이사항") as string | null,
        }));

      if (!records.length) {
        toast.error("불러올 행이 없습니다", { description: "엑셀 헤더가 '실적장표' 형식인지 확인하세요." });
        return;
      }

      // 청크 단위로 insert
      const chunk = 200;
      for (let i = 0; i < records.length; i += chunk) {
        const { error } = await supabase.from("sales").insert(records.slice(i, i + chunk));
        if (error) throw error;
      }
      toast.success(`엑셀 업로드 완료`, { description: `${records.length}건이 저장되었습니다.` });
      load();
    } catch (err) {
      toast.error("엑셀 업로드 실패", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <Header title="실적 입력 / 원장" subtitle="엑셀 '실적장표' 시트와 동일한 모든 항목을 1건 단위로 저장합니다" showScopeToggle={false} />

      {/* 엑셀 업로드 */}
      <section className="glass rounded-2xl p-5 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-card-elevated">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow shrink-0">
            <FileSpreadsheet className="size-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold">엑셀 일괄 업로드</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              '실적장표' 시트(.xlsx)를 그대로 업로드하면 모든 행이 자동 저장됩니다.
            </div>
          </div>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            variant="outline"
            className="rounded-xl"
          >
            <Upload className="size-4 mr-2" />
            엑셀 선택
          </Button>
        </div>
      </section>

      {/* 입력 폼 */}
      <form onSubmit={onSubmit} className="space-y-5 pb-10">
        <FormSection title="기본 정보" icon={<Zap className="size-3" />}>
          <Grid cols={3}>
            <Field label="인입경로 *">
              <Select value={form.channel ?? ""} onValueChange={(v) => set("channel", v)}>
                <SelectTrigger className="h-11 bg-input/60"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="담당자 *">
              <Input value={form.manager ?? ""} onChange={(e) => set("manager", e.target.value)} className="h-11 bg-input/60" required />
            </Field>
            <Field label="개통년월">
              <Input value={form.open_month ?? ""} onChange={(e) => set("open_month", e.target.value)} placeholder="2026. 4. 10" className="h-11 bg-input/60" />
            </Field>
          </Grid>
          <div className="flex items-center gap-3 pt-2">
            <Switch checked={!!form.moyo_excluded} onCheckedChange={(v) => set("moyo_excluded", v)} />
            <Label className="text-xs">모요 미적용</Label>
          </div>
        </FormSection>

        <FormSection title="가입 정보">
          <Grid cols={3}>
            <Field label="가입상품 *">
              <Select value={form.product ?? ""} onValueChange={(v) => set("product", v)}>
                <SelectTrigger className="h-11 bg-input/60"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="판매유형 *">
              <Select value={form.sale_type ?? ""} onValueChange={(v) => set("sale_type", v)}>
                <SelectTrigger className="h-11 bg-input/60"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{SALE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="개통방식">
              <Select value={form.open_method ?? ""} onValueChange={(v) => set("open_method", v)}>
                <SelectTrigger className="h-11 bg-input/60"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{OPEN_METHODS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="최종상태">
              <Select value={form.status ?? "개통완료"} onValueChange={(v) => set("status", v)}>
                <SelectTrigger className="h-11 bg-input/60"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="개통일자">
              <Input type="date" value={form.open_date ?? ""} onChange={(e) => set("open_date", e.target.value)} className="h-11 bg-input/60" />
            </Field>
            <Field label="동판/번들">
              <Input value={form.bundle ?? ""} onChange={(e) => set("bundle", e.target.value)} className="h-11 bg-input/60" />
            </Field>
          </Grid>
          <Grid cols={3}>
            <Field label="고객명 *">
              <Input value={form.customer_name ?? ""} onChange={(e) => set("customer_name", e.target.value)} className="h-11 bg-input/60" required />
            </Field>
            <Field label="생년월일">
              <Input value={form.birth_date ?? ""} onChange={(e) => set("birth_date", e.target.value)} placeholder="900101" className="h-11 bg-input/60" />
            </Field>
            <Field label="연락처">
              <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="010-0000-0000" className="h-11 bg-input/60" />
            </Field>
          </Grid>
          <Grid cols={2}>
            <Field label="단말기">
              <Input value={form.device_model ?? ""} onChange={(e) => set("device_model", e.target.value)} placeholder="UIP17PR-256" className="h-11 bg-input/60" />
            </Field>
            <Field label="단말 일련번호">
              <Input value={form.device_serial ?? ""} onChange={(e) => set("device_serial", e.target.value)} className="h-11 bg-input/60" />
            </Field>
            <Field label="USIM">
              <Input value={form.usim_model ?? ""} onChange={(e) => set("usim_model", e.target.value)} className="h-11 bg-input/60" />
            </Field>
            <Field label="USIM 일련번호">
              <Input value={form.usim_serial ?? ""} onChange={(e) => set("usim_serial", e.target.value)} className="h-11 bg-input/60" />
            </Field>
          </Grid>
          <Grid cols={3}>
            <Field label="개통요금제">
              <Select value={form.rate_plan ?? ""} onValueChange={(v) => set("rate_plan", v)}>
                <SelectTrigger className="h-11 bg-input/60"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{RATE_PLANS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="부가서비스 1">
              <Input value={form.vas1 ?? ""} onChange={(e) => set("vas1", e.target.value)} className="h-11 bg-input/60" />
            </Field>
            <Field label="부가서비스 2">
              <Input value={form.vas2 ?? ""} onChange={(e) => set("vas2", e.target.value)} className="h-11 bg-input/60" />
            </Field>
          </Grid>
        </FormSection>

        <FormSection title="수익성 / 미수금">
          <Grid cols={4}>
            <Field label="단가표 기준 (₩)">
              <Input type="number" value={form.unit_price ?? ""} onChange={(e) => set("unit_price", Number(e.target.value))} className="h-11 bg-input/60 tabular-nums" />
            </Field>
            <Field label="VAS 수수료 (₩)">
              <Input type="number" value={form.vas_fee ?? ""} onChange={(e) => set("vas_fee", Number(e.target.value))} className="h-11 bg-input/60 tabular-nums" />
            </Field>
            <Field label="상품권">
              <Input value={form.voucher ?? ""} onChange={(e) => set("voucher", e.target.value)} className="h-11 bg-input/60" />
            </Field>
            <Field label="반납 유/무">
              <Input value={form.voucher_returned ?? ""} onChange={(e) => set("voucher_returned", e.target.value)} placeholder="유 / 무" className="h-11 bg-input/60" />
            </Field>
          </Grid>
          <Grid cols={2}>
            <Field label="미수금액 (₩)">
              <Input type="number" value={form.receivable_amount ?? ""} onChange={(e) => set("receivable_amount", Number(e.target.value))} className="h-11 bg-input/60 tabular-nums" />
            </Field>
            <Field label="입금 유/무">
              <Input value={form.receivable_paid ?? ""} onChange={(e) => set("receivable_paid", e.target.value)} placeholder="유 / 무 / 완료" className="h-11 bg-input/60" />
            </Field>
          </Grid>
        </FormSection>

        <FormSection title="지원금">
          <div className="flex items-center gap-3">
            <Switch checked={!!form.cash_open} onCheckedChange={(v) => set("cash_open", v)} />
            <Label className="text-xs">현금개통</Label>
          </div>
          <Grid cols={2}>
            <Field label="유통망 지원금 (₩)">
              <Input type="number" value={form.distributor_amount ?? ""} onChange={(e) => set("distributor_amount", Number(e.target.value))} className="h-11 bg-input/60 tabular-nums" />
            </Field>
            <Field label="추가지원금 (₩)">
              <Input type="number" value={form.extra_subsidy ?? ""} onChange={(e) => set("extra_subsidy", Number(e.target.value))} className="h-11 bg-input/60 tabular-nums" />
            </Field>
          </Grid>
          <Grid cols={4}>
            <Field label="현금 입금금액 (₩)">
              <Input type="number" value={form.cash_support_amount ?? ""} onChange={(e) => set("cash_support_amount", Number(e.target.value))} className="h-11 bg-input/60 tabular-nums" />
            </Field>
            <Field label="은행">
              <Select value={form.cash_bank ?? ""} onValueChange={(v) => set("cash_bank", v)}>
                <SelectTrigger className="h-11 bg-input/60"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="입금계좌">
              <Input value={form.cash_account ?? ""} onChange={(e) => set("cash_account", e.target.value)} className="h-11 bg-input/60" />
            </Field>
            <Field label="예금주">
              <Input value={form.cash_holder ?? ""} onChange={(e) => set("cash_holder", e.target.value)} className="h-11 bg-input/60" />
            </Field>
          </Grid>
        </FormSection>

        <FormSection title="최종 / 배송">
          <Grid cols={3}>
            <Field label="최종 수수료 (₩)">
              <Input type="number" value={form.net_fee ?? ""} onChange={(e) => set("net_fee", Number(e.target.value))} className="h-11 bg-input/60 tabular-nums" />
            </Field>
            <Field label="발송유형">
              <Select value={form.delivery_type ?? ""} onValueChange={(v) => set("delivery_type", v)}>
                <SelectTrigger className="h-11 bg-input/60"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{DELIVERY_TYPES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="운송장">
              <Input value={form.tracking_no ?? ""} onChange={(e) => set("tracking_no", e.target.value)} className="h-11 bg-input/60" />
            </Field>
          </Grid>
          <Field label="특이사항">
            <Textarea value={form.note ?? ""} onChange={(e) => set("note", e.target.value)} rows={2} className="bg-input/60" />
          </Field>
        </FormSection>

        <div className="flex gap-3">
          {editingId && (
            <Button type="button" variant="outline" onClick={reset} className="h-12 rounded-2xl">
              <X className="size-4 mr-2" /> 취소
            </Button>
          )}
          <Button type="submit" disabled={busy} className="flex-1 h-12 bg-gradient-primary shadow-glow rounded-2xl text-base font-semibold">
            <Check className="size-5 mr-2" /> {editingId ? "수정 저장" : "판매 1건 저장"}
          </Button>
        </div>
      </form>

      {/* 최근 판매 원장 */}
      <section className="glass-strong rounded-2xl p-5 md:p-6 shadow-card-elevated">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold">최근 판매 원장 (최신 50건)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">본인이 입력한 건만 수정·삭제할 수 있습니다.</p>
          </div>
          <Badge className="bg-primary/15 text-primary-glow border-primary/30">{rows.length}건</Badge>
        </div>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="text-[11px] text-muted-foreground border-b border-border/40">
                <th className="text-left px-3 py-2 font-medium">개통일</th>
                <th className="text-left px-3 py-2 font-medium">경로</th>
                <th className="text-left px-3 py-2 font-medium">담당</th>
                <th className="text-left px-3 py-2 font-medium">상품</th>
                <th className="text-left px-3 py-2 font-medium">판매유형</th>
                <th className="text-left px-3 py-2 font-medium">고객</th>
                <th className="text-left px-3 py-2 font-medium">단말</th>
                <th className="text-right px-3 py-2 font-medium">단가표</th>
                <th className="text-right px-3 py-2 font-medium">최종</th>
                <th className="text-right px-3 py-2 font-medium">관리</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const mine = r.created_by === user?.id;
                return (
                  <tr key={r.id} className={cn("border-b border-border/20 hover:bg-white/[0.03]", mine && "bg-primary/[0.04]")}>
                    <td className="px-3 py-2.5">{r.open_date ?? "-"}</td>
                    <td className="px-3 py-2.5">{r.channel ?? "-"}</td>
                    <td className="px-3 py-2.5">{r.manager ?? "-"}</td>
                    <td className="px-3 py-2.5">{r.product ?? "-"}</td>
                    <td className="px-3 py-2.5">{r.sale_type ?? "-"}</td>
                    <td className="px-3 py-2.5">{r.customer_name ?? "-"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.device_model ?? "-"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{(r.unit_price ?? 0).toLocaleString("ko-KR")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-revenue">{(r.net_fee ?? 0).toLocaleString("ko-KR")}</td>
                    <td className="px-3 py-2.5 text-right">
                      {mine ? (
                        <div className="inline-flex gap-1">
                          <button onClick={() => onEdit(r)} className="size-7 rounded-lg grid place-items-center text-primary-glow hover:bg-primary/10">
                            <Pencil className="size-3.5" />
                          </button>
                          <button onClick={() => onDelete(r.id)} className="size-7 rounded-lg grid place-items-center text-destructive hover:bg-destructive/10">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">읽기전용</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={10} className="text-center py-10 text-muted-foreground">아직 저장된 판매 데이터가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
};

const FormSection = ({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) => (
  <section className="glass rounded-2xl p-5 md:p-6 space-y-4 shadow-card-elevated">
    <div className="flex items-center gap-2">
      {icon && <Badge className="bg-gradient-primary text-primary-foreground border-0">{icon}</Badge>}
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
    </div>
    {children}
  </section>
);

const Grid = ({ cols, children }: { cols: 2 | 3 | 4; children: React.ReactNode }) => (
  <div className={cn("grid gap-3", cols === 2 && "grid-cols-1 md:grid-cols-2", cols === 3 && "grid-cols-1 md:grid-cols-3", cols === 4 && "grid-cols-2 md:grid-cols-4")}>
    {children}
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground font-medium">{label}</Label>
    {children}
  </div>
);

export default InputPage;
