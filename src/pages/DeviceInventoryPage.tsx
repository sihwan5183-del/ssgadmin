import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Smartphone,
  Upload,
  Plus,
  Trash2,
  Pencil,
  Camera,
  FileSpreadsheet,
  Search,
  X,
  Loader2,
  Download,
  AlertTriangle,
} from "lucide-react";
import { exportToExcel, DEVICE_INVENTORY_COLUMNS } from "@/lib/excelExport";
import { useInventoryAging } from "@/hooks/useInventoryAging";
import { useLowStock } from "@/hooks/useLowStock";
import { Checkbox } from "@/components/ui/checkbox";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionBar } from "@/components/common/BulkActionBar";
import { BulkDeleteDialog } from "@/components/common/BulkDeleteDialog";
import { PurgeByFilterDialog } from "@/components/common/PurgeByFilterDialog";
import { useRole } from "@/hooks/useRole";
import { ShieldAlert } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileListCard } from "@/components/common/MobileListCard";
import { QuickScanDialog } from "@/components/inventory/QuickScanDialog";
import { ScanLine } from "lucide-react";

const STATUSES = ["입고", "재고", "판매중", "이동중", "개통완료", "반품", "반납", "불량"] as const;
type Status = typeof STATUSES[number];

const KINDS = ["휴대폰", "IoT(도그마루)"] as const;
type Kind = typeof KINDS[number];

type Device = {
  id: string;
  created_by: string;
  model: string;
  device_kind: string | null;
  serial_no: string | null;
  color: string | null;
  capacity: string | null;
  status: string;
  note: string | null;
  stock_in_date: string | null;
  purchase_price: number | null;
  current_store_id: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  입고: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  재고: "bg-primary/15 text-primary border-primary/30",
  판매중: "bg-warning/15 text-warning border-warning/30",
  이동중: "bg-secondary/15 text-secondary-foreground border-secondary/30",
  개통완료: "bg-muted/40 text-muted-foreground border-border",
  반품: "bg-destructive/15 text-destructive border-destructive/30",
  반납: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  불량: "bg-destructive/20 text-destructive border-destructive/40",
};

const KIND_COLOR: Record<string, string> = {
  "휴대폰": "bg-primary/10 text-primary border-primary/30",
  "IoT(도그마루)": "bg-purple-500/15 text-purple-300 border-purple-500/40",
};

/** 바코드 입력 정제: 공백/하이픈/제어문자 제거 + 대문자 (서버 normalize_serial_no와 동일) */
const cleanSerial = (raw: string) =>
  (raw ?? "").replace(/[\s\-_\u0000-\u001F]+/g, "").toUpperCase();

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  model: "",
  device_kind: "휴대폰" as Kind,
  serial_no: "",
  color: "",
  capacity: "",
  status: "입고" as Status,
  note: "",
  stock_in_date: todayISO(),
  purchase_price: 0,
};

export default function DeviceInventoryPage() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const isMobile = useIsMobile();
  const { agingDays, fallbackPrice, isAged, daysSince } = useInventoryAging();
  const { threshold: lowThreshold, low: lowModels } = useLowStock();
  const [rows, setRows] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [agedOnly, setAgedOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResults, setOcrResults] = useState<Array<typeof emptyForm>>([]);
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const [transferDevice, setTransferDevice] = useState<Device | null>(null);
  const [quickScanOpen, setQuickScanOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const serialInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("device_inventory")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRows((data as Device[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("device-inventory-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "device_inventory" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (kindFilter !== "all" && (r.device_kind ?? "휴대폰") !== kindFilter) return false;
      if (storeFilter !== "all" && r.current_store_id !== storeFilter) return false;
      if (agedOnly && !isAged(r.stock_in_date)) return false;
      if (!q) return true;
      return [r.model, r.serial_no, r.color, r.capacity, r.note]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter, kindFilter, storeFilter, agedOnly, isAged]);

  // 일괄 선택
  const bulk = useBulkSelection<string>(filtered.map((r) => r.id));
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const bulkDelete = async () => {
    setBulkBusy(true);
    const { error } = await supabase.from("device_inventory").delete().in("id", bulk.selectedIds);
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
  const bulkSetStatus = async (status: string) => {
    const { error } = await supabase.from("device_inventory").update({ status }).in("id", bulk.selectedIds);
    if (error) {
      toast.error("일괄 변경 실패: " + error.message);
      return;
    }
    toast.success(`${bulk.selectedIds.length}건 → ${status}`);
    bulk.clear();
    load();
  };
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    STATUSES.forEach((s) => (c[s] = 0));
    rows.forEach((r) => (c[r.status] = (c[r.status] ?? 0) + 1));
    return c;
  }, [rows]);

  const agedCount = useMemo(
    () => rows.filter((r) => r.status !== "개통완료" && isAged(r.stock_in_date)).length,
    [rows, isAged],
  );

  const totalAsset = useMemo(
    () =>
      rows
        .filter((r) => r.status !== "개통완료" && r.status !== "반품")
        .reduce(
          (s, r) =>
            s + (Number(r.purchase_price) > 0 ? Number(r.purchase_price) : fallbackPrice),
          0,
        ),
    [rows, fallbackPrice],
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, stock_in_date: todayISO() });
    setDialogOpen(true);
  };
  const openEdit = (d: Device) => {
    setEditing(d);
    setForm({
      model: d.model ?? "",
      device_kind: ((d.device_kind as Kind) ?? "휴대폰") as Kind,
      serial_no: d.serial_no ?? "",
      color: d.color ?? "",
      capacity: d.capacity ?? "",
      status: (d.status as Status) ?? "재고",
      note: d.note ?? "",
      stock_in_date: d.stock_in_date ?? todayISO(),
      purchase_price: Number(d.purchase_price ?? 0),
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!user) return;
    if (!form.model.trim()) {
      toast.error("모델명을 입력하세요");
      return;
    }
    const cleanedSerial = form.serial_no ? cleanSerial(form.serial_no) : null;
    // 클라이언트 사전 중복 체크 (활성 재고 한정)
    if (cleanedSerial) {
      const dup = rows.find(
        (r) =>
          r.serial_no === cleanedSerial &&
          r.id !== editing?.id &&
          !["개통완료", "판매완료", "반품", "반납", "불량"].includes(r.status),
      );
      if (dup) {
        toast.error(`이미 등록된 재고입니다 (${dup.model} · ${dup.status})`);
        return;
      }
    }
    const payload: any = {
      model: form.model,
      device_kind: form.device_kind,
      serial_no: cleanedSerial,
      color: form.color || null,
      capacity: form.capacity || null,
      status: form.status,
      note: form.note || null,
      stock_in_date: form.stock_in_date || todayISO(),
      purchase_price: Number(form.purchase_price) || 0,
      created_by: user.id,
    };
    if (editing) {
      const { error } = await supabase.from("device_inventory").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("수정되었습니다");
    } else {
      const { error } = await supabase.from("device_inventory").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("등록되었습니다");
    }
    setDialogOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const { error } = await supabase.from("device_inventory").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("삭제되었습니다");
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("device_inventory").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const handleXlsx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const pick = (r: any, ...keys: string[]) => {
        for (const k of keys) if (r[k] != null && r[k] !== "") return r[k];
        return null;
      };
      const records = data
        .map((r) => {
          const kindRaw = String(pick(r, "재고유형", "유형", "Kind") ?? "휴대폰").trim();
          const kind = kindRaw.toLowerCase().includes("iot") || kindRaw.includes("도그마루") ? "IoT(도그마루)" : "휴대폰";
          const rawSerial = pick(r, "일련번호", "IMEI", "시리얼", "Serial");
          return {
            model: String(pick(r, "모델", "모델명", "Model") ?? "").trim(),
            device_kind: kind,
            serial_no: rawSerial ? cleanSerial(String(rawSerial)) : null,
            color: pick(r, "색상", "Color") ? String(pick(r, "색상", "Color")) : null,
            capacity: pick(r, "용량", "Capacity") ? String(pick(r, "용량", "Capacity")) : null,
            status: String(pick(r, "상태", "Status") ?? "입고"),
            note: pick(r, "메모", "Note") ? String(pick(r, "메모", "Note")) : null,
            stock_in_date: pick(r, "입고일", "StockInDate") ? String(pick(r, "입고일", "StockInDate")) : todayISO(),
            purchase_price: Number(pick(r, "매입가", "PurchasePrice")) || 0,
            created_by: user.id,
          };
        })
        .filter((r) => r.model);
      if (records.length === 0) return toast.error("등록할 데이터가 없습니다");
      const { error } = await supabase.from("device_inventory").insert(records);
      if (error) throw error;
      toast.success(`${records.length}건 등록되었습니다`);
      load();
    } catch (err: any) {
      toast.error(err.message ?? "엑셀 처리 실패");
    } finally {
      if (xlsxInputRef.current) xlsxInputRef.current.value = "";
    }
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    setOcrResults([]);
    setOcrPreview(null);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setOcrPreview(dataUrl);
      const { data, error } = await supabase.functions.invoke("device-ocr", {
        body: { imageBase64: dataUrl },
      });
      if (error) throw error;
      const devices = (data?.devices ?? []) as any[];
      if (devices.length === 0) {
        toast.warning("이미지에서 단말기 정보를 찾지 못했습니다");
      } else {
        setOcrResults(
          devices.map((d) => ({
            ...emptyForm,
            stock_in_date: todayISO(),
            model: d.model ?? "",
            serial_no: d.serial_no ?? "",
            color: d.color ?? "",
            capacity: d.capacity ?? "",
          })),
        );
        toast.success(`${devices.length}개 단말기 정보를 인식했습니다`);
      }
    } catch (err: any) {
      toast.error(err.message ?? "이미지 인식 실패");
    } finally {
      setOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveOcrResults = async () => {
    if (!user || ocrResults.length === 0) return;
    const records = ocrResults
      .filter((r) => r.model.trim())
      .map((r) => ({
        model: r.model,
        device_kind: r.device_kind || "휴대폰",
        serial_no: r.serial_no ? cleanSerial(r.serial_no) : null,
        color: r.color || null,
        capacity: r.capacity || null,
        status: r.status,
        note: r.note || null,
        stock_in_date: r.stock_in_date || todayISO(),
        purchase_price: Number(r.purchase_price) || 0,
        created_by: user.id,
      }));
    if (records.length === 0) return toast.error("저장할 항목이 없습니다");
    const { error } = await supabase.from("device_inventory").insert(records);
    if (error) return toast.error(error.message);
    toast.success(`${records.length}건 등록되었습니다`);
    setOcrOpen(false);
    setOcrResults([]);
    setOcrPreview(null);
    load();
  };

  return (
    <div className="space-y-6">
      {lowModels.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border border-warning/40 bg-warning/10">
          <AlertTriangle className="size-5 text-warning shrink-0" />
          <div className="flex-1 min-w-[200px]">
            <div className="text-sm font-semibold text-warning">
              부족재고 {lowModels.length}종 — 발주 검토 권장 (보유 ≤ {lowThreshold}대)
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {lowModels.slice(0, 12).map(([m, c]) => (
                <Badge key={m} className="text-[10px] bg-warning/20 text-warning border-warning/40">
                  {m} · {c}대
                </Badge>
              ))}
              {lowModels.length > 12 && (
                <span className="text-[10px] text-muted-foreground self-center">
                  +{lowModels.length - 12}종
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Smartphone className="size-6 text-primary-glow" />
            단말기 재고 관리
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            엑셀·이미지·수동 입력 · 입고일 기준 {agingDays}일 초과 시 우선판매 강조
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={xlsxInputRef} type="file" accept=".xlsx,.xls" onChange={handleXlsx} className="hidden" />
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleImage} className="hidden" />
          <Button variant="outline" onClick={() => exportToExcel(filtered, DEVICE_INVENTORY_COLUMNS, "단말기재고", "재고")}>
            <Download className="size-4 mr-2" /> 엑셀 내보내기
          </Button>
          <Button variant="outline" onClick={() => xlsxInputRef.current?.click()}>
            <FileSpreadsheet className="size-4 mr-2" /> 엑셀 업로드
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setOcrOpen(true);
              setTimeout(() => fileInputRef.current?.click(), 100);
            }}
          >
            <Camera className="size-4 mr-2" /> 이미지 OCR
          </Button>
          <Button onClick={openCreate}>
            <Plus className="size-4 mr-2" /> 단말기 추가
          </Button>
        </div>
      </div>

      {/* 상단 KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {STATUSES.map((s) => (
          <Card key={s} className="p-4 glass border-border/40">
            <div className="text-xs text-muted-foreground">{s}</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{counts[s] ?? 0}</div>
          </Card>
        ))}
        <Card
          className={`p-4 glass cursor-pointer transition-colors ${
            agedOnly ? "border-destructive ring-1 ring-destructive/40" : "border-destructive/40"
          }`}
          onClick={() => setAgedOnly((v) => !v)}
        >
          <div className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="size-3" /> 장기({agingDays}일+)
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1 text-destructive">{agedCount}</div>
        </Card>
        <Card className="p-4 glass border-border/40 col-span-2 md:col-span-2 lg:col-span-1">
          <div className="text-xs text-muted-foreground">총 재고 자산</div>
          <div className="text-xl font-bold tabular-nums mt-1">
            {totalAsset.toLocaleString("ko-KR")}원
          </div>
        </Card>
      </div>

      {/* 검색 / 필터 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="모델, 일련번호, 색상 검색…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 bg-input/60"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-11 bg-input/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            className="h-11 border-destructive/40 text-destructive hover:bg-destructive/10"
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
          table: "device_inventory",
          filters: [
            ...(statusFilter !== "all" ? [{ column: "status", op: "eq" as const, value: statusFilter }] : []),
            ...(storeFilter !== "all" ? [{ column: "current_store_id", op: "eq" as const, value: storeFilter }] : []),
          ],
          summary: `상태=${statusFilter === "all" ? "전체" : statusFilter}${storeFilter !== "all" ? ` · 매장 ID=${storeFilter}` : ""}`,
        }}
        onDone={load}
      />

      {isMobile ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <Checkbox
              checked={bulk.allOnPageSelected}
              onCheckedChange={(v) => bulk.togglePage(!!v)}
              className="size-5"
            />
            <span>전체선택 · 총 {filtered.length}대</span>
          </div>
          {loading ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">불러오는 중…</Card>
          ) : filtered.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">표시할 데이터가 없습니다</Card>
          ) : (
            filtered.map((r) => {
              const mine = r.created_by === user?.id;
              const days = daysSince(r.stock_in_date);
              const isOpen = r.status !== "개통완료";
              const tone: "default" | "warning" | "danger" =
                isOpen && days >= 90 ? "danger" : isOpen && days >= 60 ? "warning" : "default";
              return (
                <MobileListCard
                  key={r.id}
                  selected={bulk.isSelected(r.id)}
                  onToggleSelect={() => bulk.toggle(r.id)}
                  tone={tone}
                  title={
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{r.model}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md border ${STATUS_COLOR[r.status] ?? ""}`}>
                        {r.status}
                      </span>
                      {tone !== "default" && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${tone === "danger" ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground"}`}>
                          장기 {days}일
                        </span>
                      )}
                    </div>
                  }
                  meta={
                    <>
                      {[r.color, r.capacity].filter(Boolean).join(" / ") && (
                        <span>{[r.color, r.capacity].filter(Boolean).join(" / ")}</span>
                      )}
                      {r.serial_no && <span className="tabular-nums">SN {r.serial_no}</span>}
                    </>
                  }
                  body={
                    <div className="flex items-center justify-between gap-2">
                      <span>입고 {r.stock_in_date ?? "-"} · {days > 0 ? `${days}일 경과` : "오늘"}</span>
                      <span className="tabular-nums font-medium text-foreground">
                        {Number(r.purchase_price ?? 0).toLocaleString("ko-KR")}원
                      </span>
                    </div>
                  }
                  actions={
                    mine && (
                      <>
                        <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                          <SelectTrigger className="h-10 flex-1 min-w-[120px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="outline" onClick={() => openEdit(r)} className="h-10">
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => remove(r.id)} className="h-10">
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </>
                    )
                  }
                />
              );
            })
          )}
        </div>
      ) : (
      <Card className="glass border-border/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <Checkbox checked={bulk.allOnPageSelected} onCheckedChange={(v) => bulk.togglePage(!!v)} />
                </th>
                <th className="text-left px-3 py-2.5">모델</th>
                <th className="text-left px-3 py-2.5">일련번호</th>
                <th className="text-left px-3 py-2.5">색/용량</th>
                <th className="text-left px-3 py-2.5">입고일</th>
                <th className="text-left px-3 py-2.5">매입가</th>
                <th className="text-left px-3 py-2.5">상태</th>
                <th className="text-right px-3 py-2.5">관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-muted-foreground">불러오는 중…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-muted-foreground">표시할 데이터가 없습니다</td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const mine = r.created_by === user?.id;
                  const days = daysSince(r.stock_in_date);
                  const isOpen = r.status !== "개통완료";
                  let agingClass = "";
                  let agingBadge: { label: string; cls: string } | null = null;
                  if (isOpen && days >= 90) {
                    agingClass = "bg-destructive/10 border-l-2 border-destructive";
                    agingBadge = { label: `장기 ${days}일`, cls: "bg-destructive text-destructive-foreground" };
                  } else if (isOpen && days >= 60) {
                    agingClass = "bg-warning/10 border-l-2 border-warning";
                    agingBadge = { label: `${days}일`, cls: "bg-warning text-warning-foreground" };
                  } else if (isOpen && days >= 30) {
                    agingClass = "bg-amber-500/5 border-l-2 border-amber-500/60";
                    agingBadge = { label: `${days}일`, cls: "bg-amber-500/20 text-amber-300 border border-amber-500/40" };
                  }
                  return (
                    <tr key={r.id} className={`border-t border-border/30 hover:bg-muted/20 ${agingClass} ${bulk.isSelected(r.id) ? "bg-primary/5" : ""}`}>
                      <td className="px-3 py-2.5">
                        <Checkbox checked={bulk.isSelected(r.id)} onCheckedChange={() => bulk.toggle(r.id)} />
                      </td>
                      <td className="px-3 py-2.5 font-medium">
                        <div className="flex items-center gap-2">
                          {r.model}
                          {agingBadge && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${agingBadge.cls}`}>
                              {agingBadge.label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{r.serial_no ?? "-"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {[r.color, r.capacity].filter(Boolean).join(" / ") || "-"}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-xs">
                        {r.stock_in_date ?? "-"}
                        <div className="text-[10px] text-muted-foreground">
                          {days > 0 ? `${days}일 경과` : "오늘"}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {Number(r.purchase_price ?? 0).toLocaleString("ko-KR")}
                      </td>
                      <td className="px-3 py-2.5">
                        <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)} disabled={!mine}>
                          <SelectTrigger className={`h-7 w-28 text-xs border ${STATUS_COLOR[r.status] ?? ""}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {mine && (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                              <Trash2 className="size-3.5 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
      )}

      <BulkActionBar count={bulk.selectedCount} onClear={bulk.clear}>
        {STATUSES.map((s) => (
          <Button key={s} size="sm" variant="outline" onClick={() => bulkSetStatus(s)}>
            → {s}
          </Button>
        ))}
        <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
          <Trash2 className="size-3.5 mr-1" /> 선택 삭제
        </Button>
      </BulkActionBar>

      <BulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        count={bulk.selectedCount}
        itemLabel="대의 단말기를 삭제하시겠습니까?"
        onConfirm={bulkDelete}
        loading={bulkBusy}
        confirmLabel="삭제"
      />

      {/* 추가/수정 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "단말기 수정" : "단말기 추가"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <Field label="모델 *">
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </Field>
            <Field label="일련번호 / IMEI">
              <Input value={form.serial_no} onChange={(e) => setForm({ ...form, serial_no: e.target.value })} />
            </Field>
            <Field label="색상">
              <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </Field>
            <Field label="용량">
              <Input value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </Field>
            <Field label="입고일">
              <Input
                type="date"
                value={form.stock_in_date}
                onChange={(e) => setForm({ ...form, stock_in_date: e.target.value })}
              />
            </Field>
            <Field label="매입가 (원)">
              <Input
                type="number"
                value={form.purchase_price}
                onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="상태">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="메모" full>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={save}>{editing ? "수정" : "등록"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OCR 다이얼로그 */}
      <Dialog open={ocrOpen} onOpenChange={setOcrOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="size-5" /> 이미지에서 단말기 인식
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="size-4 mr-2" /> 이미지 선택
              </Button>
              {ocrLoading && (
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> AI가 이미지를 분석 중입니다…
                </span>
              )}
            </div>
            {ocrPreview && (
              <div className="rounded-lg overflow-hidden border border-border/40 max-h-64">
                <img src={ocrPreview} alt="preview" className="max-h-64 object-contain mx-auto" />
              </div>
            )}
            {ocrResults.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">인식된 단말기 ({ocrResults.length}건)</div>
                {ocrResults.map((r, i) => (
                  <Card key={i} className="p-3 glass border-border/40">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
                      <Field label="모델">
                        <Input
                          value={r.model}
                          onChange={(e) => {
                            const next = [...ocrResults];
                            next[i] = { ...r, model: e.target.value };
                            setOcrResults(next);
                          }}
                        />
                      </Field>
                      <Field label="일련번호">
                        <Input
                          value={r.serial_no}
                          onChange={(e) => {
                            const next = [...ocrResults];
                            next[i] = { ...r, serial_no: e.target.value };
                            setOcrResults(next);
                          }}
                        />
                      </Field>
                      <Field label="색상">
                        <Input
                          value={r.color}
                          onChange={(e) => {
                            const next = [...ocrResults];
                            next[i] = { ...r, color: e.target.value };
                            setOcrResults(next);
                          }}
                        />
                      </Field>
                      <Field label="용량">
                        <Input
                          value={r.capacity}
                          onChange={(e) => {
                            const next = [...ocrResults];
                            next[i] = { ...r, capacity: e.target.value };
                            setOcrResults(next);
                          }}
                        />
                      </Field>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setOcrResults(ocrResults.filter((_, idx) => idx !== i))}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOcrOpen(false)}>취소</Button>
            <Button onClick={saveOcrResults} disabled={ocrResults.length === 0}>
              {ocrResults.length}건 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${full ? "col-span-2" : ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
