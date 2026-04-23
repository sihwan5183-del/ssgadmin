import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle2, Download, Sparkles, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { validateRows, downloadErrorReport, type FieldRule, type RowError } from "@/lib/excelValidation";
import type { MappingTarget } from "./ExcelMappingDialog";

const SKIP = "__skip__";

/**
 * 한글 엑셀 헤더 → 시스템 field_key 별칭 사전.
 * 헤더는 정규화(공백/특수문자 제거 + 소문자) 키 기준으로 매칭.
 * 같은 의미의 다양한 표기를 한 곳에 모아 자동매핑 적중률을 높입니다.
 */
const HEADER_ALIASES: Record<string, string> = {
  // 기본 식별
  "번호": "seq", "순번": "seq", "no": "seq",
  "인입경로": "channel", "채널": "channel", "유입경로": "channel",
  "모요미적용": "moyo_excluded", "모요제외": "moyo_excluded", "모요\n미적용": "moyo_excluded",
  "담당자": "manager", "담당": "manager",
  "개통년월": "open_month", "개통월": "open_month",
  "개통일": "open_date", "개통일자": "open_date",
  "가입상품": "product", "상품": "product",
  "판매유형": "sale_type", "판매타입": "sale_type",
  "동판번들": "bundle", "동판/번들": "bundle", "번들": "bundle",
  "개통방식": "open_method", "개통방법": "open_method",
  "최종상태": "status", "상태": "status",
  // 고객 정보
  "고객명": "customer_name", "성명": "customer_name", "이름": "customer_name",
  "생년월일": "birth_date", "생일": "birth_date",
  "연락처": "phone", "전화번호": "phone", "휴대폰": "phone",
  // 단말/유심
  "단말기": "device_model", "단말": "device_model", "기종": "device_model", "모델": "device_model", "단말기모델": "device_model",
  "일련번호": "device_serial", "단말일련번호": "device_serial", "imei": "device_serial",
  "usim": "usim_model", "유심": "usim_model", "usim모델": "usim_model",
  "일련번호1": "usim_serial", "usim일련번호": "usim_serial", "유심일련번호": "usim_serial",
  "개통요금제": "rate_plan", "요금제": "rate_plan",
  "부가서비스1": "vas1", "부가서비스주셋톱": "vas1", "부가서비스.1": "vas1",
  "부가서비스2": "vas2", "부가서비스부셋톱": "vas2", "부가서비스.2": "vas2",
  // 금액 — 핵심 (대시보드 매출/마진 계산에 직접 영향)
  "단가표기준": "unit_price", "단가표기준원": "unit_price", "단가": "unit_price",
  "부가서비스수수료": "vas_fee", "부가서비스수수료원": "vas_fee", "vas수수료": "vas_fee",
  "유통망": "distributor_amount", "유통망원": "distributor_amount", "유통망지원금": "distributor_amount", "유통망지원금원": "distributor_amount",
  "추가지원금": "extra_subsidy", "추가지원금원": "extra_subsidy",
  "현금지원금": "cash_support_amount", "현금지원금원": "cash_support_amount", "현금지원": "cash_support_amount", "현금지원원": "cash_support_amount",
  "수수료": "net_fee", "수수료원": "net_fee", "정산수수료": "net_fee", "정산수수료원": "net_fee", "정산금": "net_fee",
  "미수금": "receivable_amount", "미수금원": "receivable_amount",
  "미수금입금": "receivable_paid", "미수금납입": "receivable_paid",
  "현금개통": "cash_open",
  // 상품권 / 입금
  "상품권": "voucher", "상품권반납시작성": "voucher",
  "반납유무": "voucher_returned", "상품권회수": "voucher_returned",
  "은행": "cash_bank",
  "입금계좌": "cash_account", "계좌": "cash_account", "계좌번호": "cash_account",
  "예금주": "cash_holder", "예금자": "cash_holder",
  // 발송
  "발송유형": "delivery_type", "배송유형": "delivery_type",
  "운송장": "tracking_no", "송장번호": "tracking_no", "운송장번호": "tracking_no",
  "특이사항": "note", "비고": "note", "메모": "note",
  // 입금 관련 (양식의 '금액', '입금 유/무' 같은 모호한 헤더는 사용자 매핑 유도)
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tableName: string;            // ex) "sales"
  templateKey: string;          // ex) "sales_excel_template"
  file: File | null;
  targets: MappingTarget[];     // 시스템 필드 후보
  rules: FieldRule[];           // 검증 규칙
  /** 검증된 행을 실제 DB에 저장. batchId/templateVersion은 _upload_meta로 주입됨 */
  onCommit: (rows: Record<string, any>[], meta: { batchId: string; templateVersion: string | null }) => Promise<void>;
}

type Step = "mapping" | "validate" | "confirm";

const autoMap = (headers: string[], targets: MappingTarget[]) => {
  const norm = (s: string) => s.replace(/[\s()₩\n\.\-_/\\\[\]]+/g, "").toLowerCase();
  const targetByKey = new Map(targets.map((t) => [t.field_key, t]));
  const m: Record<string, string> = {};
  for (const h of headers) {
    const nh = norm(h);
    // 1) 정확/정규화 일치 (label or field_key)
    let t = targets.find(
      (t) => t.label === h || t.field_key === h || norm(t.label) === nh || norm(t.field_key) === nh,
    );
    // 2) 별칭 사전 (한글 헤더 변형 → field_key)
    if (!t) {
      const aliasKey = HEADER_ALIASES[nh] ?? HEADER_ALIASES[h];
      if (aliasKey && targetByKey.has(aliasKey)) t = targetByKey.get(aliasKey)!;
    }
    m[h] = t ? t.field_key : SKIP;
  }
  return m;
};

export const ExcelUploadWizard = ({
  open, onOpenChange, tableName, templateKey, file, targets, rules, onCommit,
}: Props) => {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("mapping");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [presets, setPresets] = useState<{ id: string; preset_name: string; mapping: any }[]>([]);
  const [presetName, setPresetName] = useState("");
  const [working, setWorking] = useState(false);
  const [templateVersion, setTemplateVersion] = useState<string | null>(null);

  // 검증 결과
  const [validRows, setValidRows] = useState<Record<string, any>[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);

  // 파일 파싱 (헤더 자동 탐지: 1행=가이드, 2행=헤더 형식 우선)
  useEffect(() => {
    if (!file || !open) return;
    setStep("mapping");
    (async () => {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      // 2행을 헤더로 시도 → 빈 헤더면 1행을 헤더로
      let json: any[] = XLSX.utils.sheet_to_json(ws, { range: 1, defval: "" });
      let hs = json.length ? Object.keys(json[0]) : [];
      const empty = hs.every((h) => h.startsWith("__EMPTY"));
      if (empty || hs.length === 0) {
        json = XLSX.utils.sheet_to_json(ws, { defval: "" });
        hs = json.length ? Object.keys(json[0]) : [];
      }
      setHeaders(hs);
      setRows(json);
      setMapping(autoMap(hs, targets));
    })();
  }, [file, open, targets]);

  // 프리셋 + 템플릿 버전 로드
  useEffect(() => {
    if (!open) return;
    supabase.from("excel_mappings").select("id, preset_name, mapping").eq("table_name", tableName).order("updated_at", { ascending: false }).then(({ data }) => setPresets(data ?? []));
    supabase.from("app_settings").select("value").eq("key", templateKey).maybeSingle().then(({ data }) => {
      const v = (data?.value as any)?.version ?? null;
      setTemplateVersion(v);
    });
  }, [open, tableName, templateKey]);

  const requiredKeys = useMemo(() => rules.filter((r) => r.required).map((r) => r.field_key), [rules]);
  const mappedSet = useMemo(() => new Set(Object.values(mapping).filter((v) => v && v !== SKIP)), [mapping]);
  const unmappedHeaders = useMemo(() => Object.entries(mapping).filter(([_, v]) => v === SKIP).map(([h]) => h), [mapping]);
  const missingRequired = useMemo(() => requiredKeys.filter((k) => !mappedSet.has(k)), [requiredKeys, mappedSet]);

  const applyPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    const next: Record<string, string> = {};
    for (const h of headers) next[h] = (p.mapping as any)?.[h] ?? SKIP;
    setMapping(next);
    toast.success(`프리셋 "${p.preset_name}" 적용`);
  };

  const savePreset = async () => {
    if (!user) return;
    const name = presetName.trim();
    if (!name) return toast.error("프리셋 이름을 입력하세요");
    const cleaned: Record<string, string> = {};
    Object.entries(mapping).forEach(([k, v]) => { if (v && v !== SKIP) cleaned[k] = v; });
    const { error } = await supabase.from("excel_mappings").upsert(
      { table_name: tableName, preset_name: name, mapping: cleaned, created_by: user.id },
      { onConflict: "table_name,preset_name" },
    );
    if (error) toast.error(error.message);
    else { toast.success("프리셋 저장됨"); setPresetName(""); }
  };

  // 매핑 → 검증 단계 전환
  const goValidate = () => {
    const mappedRows = rows.map((r) => {
      const o: Record<string, any> = {};
      for (const [header, fieldKey] of Object.entries(mapping)) {
        if (!fieldKey || fieldKey === SKIP) continue;
        o[fieldKey] = r[header];
      }
      return o;
    });
    const result = validateRows(mappedRows, rules);
    setValidRows(result.valid);
    setErrors(result.errors);
    setStep("validate");
  };

  // 최종 commit (배치 + 메타 주입)
  const commit = async (ignoreErrors: boolean) => {
    if (!user) return;
    setWorking(true);
    try {
      // 1) batch insert
      const { data: batch, error: batchErr } = await supabase.from("upload_batches").insert({
        table_name: tableName,
        file_name: file?.name ?? "unknown.xlsx",
        template_version: templateVersion,
        mapping_preset: presetName || null,
        total_rows: rows.length,
        success_rows: validRows.length,
        error_rows: errors.length,
        error_report: errors as any,
        uploaded_by: user.id,
      }).select("id").single();
      if (batchErr || !batch) throw batchErr ?? new Error("배치 생성 실패");

      // 2) 각 row에 _upload_meta 주입 (custom_fields가 있으면 그 안, 없으면 별도 무시)
      const enriched = validRows.map((r) => {
        const meta = { batch_id: batch.id, template_version: templateVersion, uploaded_at: new Date().toISOString() };
        const cf = r.custom_fields ? { ...r.custom_fields, _upload_meta: meta } : { _upload_meta: meta };
        return { ...r, custom_fields: cf };
      });

      await onCommit(enriched, { batchId: batch.id, templateVersion });
      toast.success(`업로드 완료 — 성공 ${validRows.length}건${errors.length ? ` / 실패 ${errors.length}건 무시됨` : ""}`);
      onOpenChange(false);
      setStep("mapping");
    } catch (e) {
      toast.error("업로드 실패", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary-glow" /> 엑셀 업로드 마법사
            {templateVersion && <Badge variant="outline" className="text-[10px] ml-2">양식 버전 {templateVersion.slice(0, 16)}</Badge>}
          </DialogTitle>
          <DialogDescription>
            {step === "mapping" && "1단계 — 엑셀 헤더와 시스템 필드를 연결하세요. 미매칭 헤더는 빨간색으로 표시됩니다."}
            {step === "validate" && "2단계 — 검증 결과를 확인하세요. 오류 행을 무시하고 정상 행만 업로드하거나 취소할 수 있습니다."}
          </DialogDescription>
        </DialogHeader>

        {step === "mapping" && (
          <>
            <div className="text-xs flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline">엑셀 헤더 {headers.length}개</Badge>
              <Badge variant="outline" className="bg-primary/10">매핑 {mappedSet.size}</Badge>
              {unmappedHeaders.length > 0 && (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/40">
                  미매칭 {unmappedHeaders.length}
                </Badge>
              )}
              {missingRequired.length > 0 && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-400">
                  필수 누락 {missingRequired.length}: {missingRequired.slice(0, 3).map((k) => rules.find((r) => r.field_key === k)?.label).join(", ")}
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3 p-3 rounded-lg border border-border/40 bg-muted/20">
              <span className="text-xs font-semibold">프리셋:</span>
              {presets.length === 0 ? (
                <span className="text-xs text-muted-foreground">저장된 프리셋 없음</span>
              ) : (
                <Select onValueChange={applyPreset}>
                  <SelectTrigger className="h-8 w-56"><SelectValue placeholder="불러오기…" /></SelectTrigger>
                  <SelectContent>
                    {presets.map((p) => <SelectItem key={p.id} value={p.id}>{p.preset_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <div className="flex-1" />
              <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="현재 매핑을 프리셋으로 저장" className="h-8 w-60" />
              <Button size="sm" variant="outline" onClick={savePreset}><Save className="size-3.5 mr-1" /> 저장</Button>
            </div>

            <ScrollArea className="flex-1 rounded-lg border border-border/40">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">엑셀 헤더</th>
                    <th className="text-left px-3 py-2">샘플 값</th>
                    <th className="text-left px-3 py-2">시스템 필드</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map((h) => {
                    const isUnmapped = mapping[h] === SKIP;
                    return (
                      <tr key={h} className={`border-t border-border/30 ${isUnmapped ? "bg-destructive/5" : ""}`}>
                        <td className={`px-3 py-2 font-medium ${isUnmapped ? "text-destructive" : ""}`}>
                          {isUnmapped && <AlertTriangle className="inline size-3 mr-1" />}
                          {h}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground truncate max-w-[180px]">{String(rows[0]?.[h] ?? "")}</td>
                        <td className="px-3 py-2">
                          <Select value={mapping[h] ?? SKIP} onValueChange={(v) => setMapping({ ...mapping, [h]: v })}>
                            <SelectTrigger className={`h-8 w-full ${isUnmapped ? "border-destructive/50" : ""}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SKIP}>— 무시 —</SelectItem>
                              {targets.map((t) => (
                                <SelectItem key={t.field_key} value={t.field_key}>
                                  {t.label} <span className="text-xs text-muted-foreground">({t.field_key})</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
              <Button onClick={goValidate} disabled={mappedSet.size === 0 || missingRequired.length > 0}>
                다음: 검증 ({mappedSet.size}개 필드 매핑됨)
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "validate" && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="rounded-lg border border-border/40 p-3">
                <div className="text-xs text-muted-foreground">전체 행</div>
                <div className="text-2xl font-semibold">{rows.length}</div>
              </div>
              <div className="rounded-lg border border-border/40 p-3 bg-emerald-500/5">
                <div className="text-xs text-emerald-300 flex items-center gap-1"><CheckCircle2 className="size-3.5" /> 성공</div>
                <div className="text-2xl font-semibold text-emerald-300">{validRows.length}</div>
              </div>
              <div className="rounded-lg border border-border/40 p-3 bg-destructive/5">
                <div className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="size-3.5" /> 오류</div>
                <div className="text-2xl font-semibold text-destructive">{errors.length}</div>
              </div>
            </div>

            {errors.length > 0 ? (
              <ScrollArea className="flex-1 rounded-lg border border-border/40">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 w-16">행</th>
                      <th className="text-left px-3 py-2">필드</th>
                      <th className="text-left px-3 py-2">입력값</th>
                      <th className="text-left px-3 py-2">사유</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errors.slice(0, 200).map((e, i) => (
                      <tr key={i} className="border-t border-border/30">
                        <td className="px-3 py-1.5 font-mono text-xs">{e.row}</td>
                        <td className="px-3 py-1.5">{e.label}</td>
                        <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[180px]">{String(e.value ?? "")}</td>
                        <td className="px-3 py-1.5 text-destructive text-xs">{e.reason}</td>
                      </tr>
                    ))}
                    {errors.length > 200 && (
                      <tr><td colSpan={4} className="text-center text-xs text-muted-foreground py-2">… 외 {errors.length - 200}건 (오류 리포트 다운로드로 전체 확인)</td></tr>
                    )}
                  </tbody>
                </table>
              </ScrollArea>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground rounded-lg border border-border/40 bg-emerald-500/5">
                <CheckCircle2 className="size-5 text-emerald-400 mr-2" /> 모든 행이 검증을 통과했습니다.
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep("mapping")} disabled={working}>이전</Button>
              {errors.length > 0 && (
                <Button variant="outline" onClick={() => downloadErrorReport(errors, `${tableName}_오류리포트.xlsx`)} disabled={working}>
                  <Download className="size-4 mr-1.5" /> 오류 리포트
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={working}>취소</Button>
              <Button onClick={() => commit(errors.length > 0)} disabled={working || validRows.length === 0}>
                {working ? "저장 중…" : errors.length > 0 ? `오류 무시하고 ${validRows.length}건 업로드` : `${validRows.length}건 업로드`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
