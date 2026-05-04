import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Pencil, X, FileSpreadsheet, Download, Sparkles } from "lucide-react";
import { exportToExcel, SALES_COLUMNS, OFFER_COLUMNS } from "@/lib/excelExport";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFieldDefinitions } from "@/hooks/useFieldDefinitions";
import { useNetFeeFormula } from "@/hooks/useNetFeeFormula";
import { ExcelMappingDialog, type MappingTarget } from "@/components/admin/ExcelMappingDialog";
import { ExcelTemplateEditor } from "@/components/admin/ExcelTemplateEditor";
import { ExcelUploadWizard } from "@/components/admin/ExcelUploadWizard";
import type { FieldRule } from "@/lib/excelValidation";
import { useQuickExport, useLastUpdated } from "@/hooks/useQuickExport";
import { usePeriod } from "@/contexts/PeriodContext";
import { SaleEditForm } from "@/components/sales/SaleEditForm";

const InputPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [editingId, setEditingId] = useState<string | null>(searchParams.get("edit"));
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const mappingFileRef = useRef<HTMLInputElement>(null);
  const { startDate, endDate, label: periodLabel } = usePeriod();
  const quickExport = useQuickExport();
  const lastUpdated = useLastUpdated("sales");
  const { fields: dynamicFields } = useFieldDefinitions("sales");
  const { calc: calcNetFee } = useNetFeeFormula();
  const { isAdmin } = useRole();

  // SaleEditForm 내부에서 URL ?edit 자동 처리. 헤더 제목에 반영하기 위해 동기화.
  useEffect(() => {
    setEditingId(searchParams.get("edit"));
  }, [searchParams]);

  const handleExport = async () => {
    const { data, error } = await supabase
      .from("sales").select("*")
      .gte("open_date", startDate).lte("open_date", endDate)
      .order("open_date", { ascending: false, nullsFirst: false });
    if (error) return toast.error("엑셀 내보내기 실패", { description: error.message });
    exportToExcel(data ?? [], SALES_COLUMNS, `실적장표_${periodLabel.replace(/\s/g, "")}`, "실적");
  };

  const handleExportOffers = async () => {
    const { data, error } = await supabase
      .from("sales")
      .select(
        "seq, open_date, channel, manager, customer_name, phone, product, sale_type, device_model, rate_plan, unit_price, vas_fee, distributor_amount, extra_subsidy, cash_support_amount, receivable_amount, receivable_paid, cash_open, cash_bank, cash_account, cash_holder, voucher, voucher_returned, net_fee, approval_status, note",
      )
      .gte("open_date", startDate).lte("open_date", endDate)
      .order("open_date", { ascending: false, nullsFirst: false });
    if (error) return toast.error("오퍼 내보내기 실패", { description: error.message });
    const filtered = (data ?? []).filter((r: any) =>
      Number(r.distributor_amount ?? 0) > 0 ||
      Number(r.extra_subsidy ?? 0) > 0 ||
      Number(r.cash_support_amount ?? 0) > 0 ||
      Number(r.receivable_amount ?? 0) > 0 ||
      r.cash_open === true ||
      (r.voucher && String(r.voucher).trim() !== ""),
    );
    const mapped = filtered.map((r: any) => ({ ...r, cash_open: r.cash_open ? "Y" : "" }));
    exportToExcel(mapped, OFFER_COLUMNS, `오퍼_지원금관리_${periodLabel.replace(/\s/g, "")}`, "오퍼관리");
  };

  // === 매핑 엔진 업로드 ===
  const targets: MappingTarget[] = [
    ...SALES_COLUMNS.map(([k, l]) => ({ field_key: k, label: l })),
    ...dynamicFields.map((f) => ({ field_key: `custom_fields.${f.field_key}`, label: f.label })),
  ];

  const SALES_RULES: FieldRule[] = useMemo(() => [
    { field_key: "channel", label: "인입경로", required: true },
    { field_key: "manager", label: "담당자", required: true },
    { field_key: "customer_name", label: "고객명", required: true },
    { field_key: "open_date", label: "개통일", type: "date" },
    { field_key: "birth_date", label: "생년월일" },
    { field_key: "unit_price", label: "단가표 기준", type: "number" },
    { field_key: "vas_fee", label: "부가서비스 수수료", type: "number" },
    { field_key: "receivable_amount", label: "금액", type: "number" },
    { field_key: "distributor_amount", label: "유통망", type: "number" },
    { field_key: "extra_subsidy", label: "추가지원금", type: "number" },
    { field_key: "cash_support_amount", label: "입금금액", type: "number" },
    { field_key: "net_fee", label: "수수료", type: "number" },
    { field_key: "moyo_excluded", label: "모요 미적용", type: "boolean" },
    { field_key: "cash_open", label: "현금개통", type: "boolean" },
  ], []);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardFile, setWizardFile] = useState<File | null>(null);

  const onMappingFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setWizardFile(f);
    setWizardOpen(true);
    if (mappingFileRef.current) mappingFileRef.current.value = "";
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleWizardCommit = async (rows: Record<string, any>[]): Promise<void> => {
    if (!user || rows.length === 0) return;
    const records = rows.map((r) => {
      const custom: Record<string, any> = r.custom_fields ?? {};
      const base: Record<string, any> = { created_by: user.id };
      for (const [k, v] of Object.entries(r)) {
        if (k === "custom_fields") continue;
        if (k.startsWith("custom_fields.")) custom[k.slice("custom_fields.".length)] = v;
        else base[k] = v;
      }
      if (base.net_fee == null || base.net_fee === 0) base.net_fee = calcNetFee(base);
      base.custom_fields = custom;
      return base;
    });
    const chunk = 200;
    for (let i = 0; i < records.length; i += chunk) {
      const { error } = await supabase.from("sales").insert(records.slice(i, i + chunk) as any);
      if (error) throw error;
    }
    toast.success("업로드 완료");
  };

  const TEMPLATE_KEY = "sales_excel_template";
  const FALLBACK_HEADERS = [
    "번호","인입경로","모요\n미적용","담당자","개통년월","가입상품","판매유형","동판/번들",
    "개통방식","최종상태","개통일자","고객명","생년월일","연락처",
    "단말기","일련번호","USIM","일련번호.1","개통요금제",
    "부가서비스.1","부가서비스.2","단가표 기준","부가서비스 수수료",
    "상품권\n*반납시 작성","반납\n유/무","금액","입금\n유/무",
    "현금개통","유통망","추가지원금","입금금액","은행","입금계좌","예금주",
    "수수료","발송유형","운송장","특이사항",
  ];
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);

  const downloadTemplate = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings").select("value, updated_at")
        .eq("key", TEMPLATE_KEY).maybeSingle();
      if (error) throw error;
      const tpl: any = data?.value ?? {
        sheet_name: "실적장표",
        guide: "실적장표 — 이 행은 안내용입니다 (삭제하지 마세요). 데이터는 3행부터 입력하세요.",
        headers: FALLBACK_HEADERS.map((k) => ({ key: k, example: "" })),
      };
      const savedHeaders: { key: string; example: any }[] = Array.isArray(tpl.headers) ? tpl.headers : [];
      const savedKeys = new Set(savedHeaders.map((h) => h.key));
      const mergedHeaders = [
        ...savedHeaders,
        ...FALLBACK_HEADERS.filter((key) => !savedKeys.has(key)).map((key) => ({ key, example: "" })),
      ];
      const headers = mergedHeaders.length > 0 ? mergedHeaders : FALLBACK_HEADERS.map((k) => ({ key: k, example: "" }));
      const wb = XLSX.utils.book_new();
      const aoa: any[][] = [
        [tpl.guide ?? ""], headers.map((h) => h.key), headers.map((h) => h.example ?? ""),
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = headers.map(() => ({ wch: 14 }));
      XLSX.utils.book_append_sheet(wb, ws, tpl.sheet_name ?? "실적장표");
      XLSX.writeFile(wb, `실적장표_양식샘플_${new Date().toISOString().slice(0, 10)}.xlsx`);
      const verLabel = data?.updated_at ? new Date(data.updated_at).toLocaleString("ko-KR") : "기본값";
      toast.success(`양식 샘플 다운로드 완료 (${headers.length}개 컬럼)`, {
        description: `최신 저장본: ${verLabel} · 3행부터 입력 후 '기본 양식 업로드'로 올려주세요.`,
      });
    } catch (e) {
      toast.error("양식 다운로드 실패", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  // (기본 양식 업로드는 위저드 사용 — 단순 엑셀 import 경로는 제거)

  return (
    <>
      <Header
        title={editingId ? "실적 수정" : "실적 입력 / 원장"}
        subtitle={editingId
          ? "기존 데이터를 수정하고 있습니다. 완료 후 '수정 저장'을 눌러주세요."
          : "엑셀 '실적장표' 시트와 동일한 모든 항목을 1건 단위로 저장합니다"}
        showScopeToggle={false}
        showPeriodFilter
      />

      {editingId && (
        <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 flex items-center gap-2 text-sm">
          <Pencil className="size-4 text-warning shrink-0" />
          <span className="font-semibold text-warning">실적 수정 중</span>
          <span className="text-muted-foreground">— 변경 후 하단의 '수정 저장' 버튼을 눌러 반영하세요.</span>
          <Button size="sm" variant="ghost" className="ml-auto text-xs" onClick={() => { setEditingId(null); navigate("/sales-ledger"); }}>
            <X className="size-3.5 mr-1" /> 수정 취소
          </Button>
        </div>
      )}

      {/* 엑셀 업로드 */}
      <section className="glass rounded-2xl p-5 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-card-elevated">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow shrink-0">
            <FileSpreadsheet className="size-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              엑셀 일괄 업로드
              <span className="text-[10px] font-normal text-muted-foreground">{lastUpdated.text}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              '실적장표' 시트(.xlsx)를 그대로 업로드하면 모든 행이 자동 저장됩니다.
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input ref={mappingFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onMappingFile} />
          <Button type="button"
            onClick={() => quickExport.exportNow("sales", { start_date: startDate, end_date: endDate })}
            disabled={busy || quickExport.busy === "sales"}
            variant="outline" className="rounded-xl"
            title="현재 적용된 기간 필터로 즉시 엑셀 추출">
            <Download className="size-4 mr-2" />
            {quickExport.busy === "sales" ? "생성 중…" : "현재 필터로 다운로드"}
          </Button>
          <Button type="button" onClick={downloadTemplate} disabled={busy} variant="outline"
            className="rounded-xl border-primary/40 text-primary-glow hover:bg-primary/10">
            <Download className="size-4 mr-2" /> 양식 샘플 다운로드
          </Button>
          {isAdmin && (
            <Button type="button" onClick={() => setTemplateEditorOpen(true)} disabled={busy} variant="outline" className="rounded-xl">
              <Pencil className="size-4 mr-2" /> 양식 편집
            </Button>
          )}
          <Button type="button" onClick={() => mappingFileRef.current?.click()} disabled={busy} variant="outline"
            className="rounded-xl border-primary/40 text-primary-glow hover:bg-primary/10">
            <Sparkles className="size-4 mr-2" /> 엑셀 업로드 (스마트 매핑 + 검증)
          </Button>
          <Button type="button" onClick={handleExportOffers} disabled={busy} variant="outline"
            className="rounded-xl border-amber-400 text-amber-700 hover:bg-amber-50">
            <Download className="size-4 mr-2" /> 오퍼(지원금) 다운로드
          </Button>
        </div>
      </section>

      {/* 실적 폼 — 단일 진입점 (검수창과 동일 컴포넌트 사용) */}
      <SaleEditForm
        onSaved={() => navigate("/sales-ledger", { state: { refresh: Date.now() } })}
        onCancel={() => { setEditingId(null); navigate("/sales-ledger"); }}
      />

      <ExcelUploadWizard
        open={wizardOpen} onOpenChange={setWizardOpen}
        tableName="sales" templateKey={TEMPLATE_KEY}
        file={wizardFile} targets={targets} rules={SALES_RULES}
        onCommit={handleWizardCommit}
      />

      <ExcelTemplateEditor
        open={templateEditorOpen} onOpenChange={setTemplateEditorOpen}
        settingKey={TEMPLATE_KEY} title="실적 엑셀 양식 편집"
        defaultHeaders={FALLBACK_HEADERS} defaultSheetName="실적장표"
        defaultGuide="실적장표 — 이 행은 안내용입니다 (삭제하지 마세요). 데이터는 3행부터 입력하세요."
      />

      <section className="glass rounded-2xl p-4 text-center">
        <Button variant="outline" onClick={() => navigate("/sales-ledger")} className="rounded-xl gap-2">
          📋 판매원장 관리 페이지로 이동
        </Button>
      </section>
    </>
  );
};

export default InputPage;
