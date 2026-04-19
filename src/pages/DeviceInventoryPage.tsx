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
import { Smartphone, Upload, Plus, Trash2, Pencil, Camera, FileSpreadsheet, Search, X, Loader2 } from "lucide-react";

const STATUSES = ["재고", "예약", "판매완료", "반품"] as const;
type Status = typeof STATUSES[number];

type Device = {
  id: string;
  created_by: string;
  model: string;
  serial_no: string | null;
  color: string | null;
  capacity: string | null;
  status: string;
  stock_in_date: string | null;
  purchase_price: number | null;
  supplier: string | null;
  note: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  재고: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  예약: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  판매완료: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  반품: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const emptyForm = {
  model: "",
  serial_no: "",
  color: "",
  capacity: "",
  status: "재고" as Status,
  stock_in_date: new Date().toISOString().slice(0, 10),
  purchase_price: 0,
  supplier: "",
  note: "",
};

export default function DeviceInventoryPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResults, setOcrResults] = useState<Array<typeof emptyForm>>([]);
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xlsxInputRef = useRef<HTMLInputElement>(null);

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
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.model, r.serial_no, r.color, r.capacity, r.supplier, r.note]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { 재고: 0, 예약: 0, 판매완료: 0, 반품: 0 };
    rows.forEach((r) => (c[r.status] = (c[r.status] ?? 0) + 1));
    return c;
  }, [rows]);

  const groupedByModel = useMemo(() => {
    const m = new Map<string, Device[]>();
    filtered.forEach((d) => {
      const k = d.model || "(미지정)";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(d);
    });
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };
  const openEdit = (d: Device) => {
    setEditing(d);
    setForm({
      model: d.model ?? "",
      serial_no: d.serial_no ?? "",
      color: d.color ?? "",
      capacity: d.capacity ?? "",
      status: (d.status as Status) ?? "재고",
      stock_in_date: d.stock_in_date ?? new Date().toISOString().slice(0, 10),
      purchase_price: Number(d.purchase_price ?? 0),
      supplier: d.supplier ?? "",
      note: d.note ?? "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!user) return;
    if (!form.model.trim()) {
      toast.error("모델명을 입력하세요");
      return;
    }
    const payload = {
      ...form,
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

  // 엑셀 업로드
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
        .map((r) => ({
          model: String(pick(r, "모델", "모델명", "Model") ?? "").trim(),
          serial_no: pick(r, "일련번호", "IMEI", "시리얼", "Serial") ? String(pick(r, "일련번호", "IMEI", "시리얼", "Serial")) : null,
          color: pick(r, "색상", "Color") ? String(pick(r, "색상", "Color")) : null,
          capacity: pick(r, "용량", "Capacity") ? String(pick(r, "용량", "Capacity")) : null,
          status: String(pick(r, "상태", "Status") ?? "재고"),
          stock_in_date: pick(r, "입고일", "Date") ? String(pick(r, "입고일", "Date")).slice(0, 10) : new Date().toISOString().slice(0, 10),
          purchase_price: Number(pick(r, "매입가", "Price") ?? 0) || 0,
          supplier: pick(r, "공급처", "Supplier") ? String(pick(r, "공급처", "Supplier")) : null,
          note: pick(r, "메모", "Note") ? String(pick(r, "메모", "Note")) : null,
          created_by: user.id,
        }))
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

  // 이미지 OCR
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
            model: d.model ?? "",
            serial_no: d.serial_no ?? "",
            color: d.color ?? "",
            capacity: d.capacity ?? "",
          }))
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
      .map((r) => ({ ...r, purchase_price: Number(r.purchase_price) || 0, created_by: user.id }));
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
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Smartphone className="size-6 text-primary-glow" />
            단말기 재고 관리
          </h1>
          <p className="text-sm text-muted-foreground mt-1">엑셀·이미지·수동 입력으로 보유 단말기를 관리합니다</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={xlsxInputRef} type="file" accept=".xlsx,.xls" onChange={handleXlsx} className="hidden" />
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleImage} className="hidden" />
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

      {/* 상태별 집계 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATUSES.map((s) => (
          <Card key={s} className="p-4 glass border-border/40">
            <div className="text-xs text-muted-foreground">{s}</div>
            <div className="text-3xl font-bold tabular-nums mt-1">{counts[s] ?? 0}</div>
          </Card>
        ))}
      </div>

      {/* 검색 / 필터 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="모델, 일련번호, 색상, 공급처 검색…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 bg-input/60"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-11 bg-input/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">리스트 뷰</TabsTrigger>
          <TabsTrigger value="grouped">모델별 카드</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <Card className="glass border-border/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2.5">모델</th>
                    <th className="text-left px-3 py-2.5">일련번호</th>
                    <th className="text-left px-3 py-2.5">색상</th>
                    <th className="text-left px-3 py-2.5">용량</th>
                    <th className="text-left px-3 py-2.5">상태</th>
                    <th className="text-left px-3 py-2.5">입고일</th>
                    <th className="text-right px-3 py-2.5">매입가</th>
                    <th className="text-left px-3 py-2.5">공급처</th>
                    <th className="text-right px-3 py-2.5">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-muted-foreground">
                        불러오는 중…
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-muted-foreground">
                        등록된 단말기가 없습니다
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => {
                      const mine = r.created_by === user?.id;
                      return (
                        <tr key={r.id} className="border-t border-border/30 hover:bg-muted/20">
                          <td className="px-3 py-2.5 font-medium">{r.model}</td>
                          <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{r.serial_no ?? "-"}</td>
                          <td className="px-3 py-2.5">{r.color ?? "-"}</td>
                          <td className="px-3 py-2.5">{r.capacity ?? "-"}</td>
                          <td className="px-3 py-2.5">
                            <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)} disabled={!mine}>
                              <SelectTrigger className={`h-7 w-28 text-xs border ${STATUS_COLOR[r.status] ?? ""}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{r.stock_in_date ?? "-"}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {(r.purchase_price ?? 0).toLocaleString("ko-KR")}
                          </td>
                          <td className="px-3 py-2.5">{r.supplier ?? "-"}</td>
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
        </TabsContent>

        <TabsContent value="grouped" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {groupedByModel.length === 0 ? (
              <div className="text-center text-muted-foreground py-10 col-span-full">표시할 데이터가 없습니다</div>
            ) : (
              groupedByModel.map(([model, list]) => {
                const c: Record<string, number> = {};
                list.forEach((d) => (c[d.status] = (c[d.status] ?? 0) + 1));
                return (
                  <Card key={model} className="p-5 glass border-border/40">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs text-muted-foreground">모델</div>
                        <div className="text-lg font-semibold">{model}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">총</div>
                        <div className="text-3xl font-bold tabular-nums text-primary-glow">{list.length}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {STATUSES.map((s) => (
                        <Badge key={s} variant="outline" className={`${STATUS_COLOR[s] ?? ""} border`}>
                          {s} {c[s] ?? 0}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

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
            <Field label="상태">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="입고일">
              <Input type="date" value={form.stock_in_date} onChange={(e) => setForm({ ...form, stock_in_date: e.target.value })} />
            </Field>
            <Field label="매입가 (₩)">
              <Input
                type="number"
                value={form.purchase_price}
                onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) })}
              />
            </Field>
            <Field label="공급처">
              <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            </Field>
            <Field label="메모" full>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              취소
            </Button>
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
                <div className="text-sm font-medium">인식된 단말기 ({ocrResults.length}건) — 수정 후 저장</div>
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
            <Button variant="outline" onClick={() => setOcrOpen(false)}>
              취소
            </Button>
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
