import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, ScanLine, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
  /** IoT(도그마루) 모드: 모델 고정 + 부가 필드 숨김 */
  iotMode?: boolean;
}

const IOT_FIXED_MODEL = "우리집지킴이Easy2";

/** 바코드/공백/특수문자 제거 + 대문자화 (서버 정규화와 동일 규칙) */
const normalizeSerial = (raw: string) =>
  (raw ?? "").replace(/[\s\-_\u0000-\u001F]+/g, "").toUpperCase();

const todayISO = () => new Date().toISOString().slice(0, 10);

export const QuickScanDialog = ({ open, onOpenChange, onDone, iotMode = false }: Props) => {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [model, setModel] = useState(iotMode ? IOT_FIXED_MODEL : "");
  const [kind, setKind] = useState<string>(iotMode ? "IoT(도그마루)" : "휴대폰");
  const [color, setColor] = useState("");
  const [capacity, setCapacity] = useState("");
  const [stockInDate, setStockInDate] = useState(todayISO());
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [serialBuf, setSerialBuf] = useState("");
  const [list, setList] = useState<string[]>([]);
  const [bulkText, setBulkText] = useState("");
  const [busy, setBusy] = useState(false);
  const [existingSerials, setExistingSerials] = useState<Set<string>>(new Set());

  // 활성 재고 일련번호 캐시 (중복 체크용)
  useEffect(() => {
    if (!open) return;
    setList([]);
    setSerialBuf("");
    setBulkText("");
    setModel(iotMode ? IOT_FIXED_MODEL : "");
    setKind(iotMode ? "IoT(도그마루)" : "휴대폰");
    setColor("");
    setCapacity("");
    setPurchasePrice(0);
    (async () => {
      const { data } = await supabase
        .from("device_inventory")
        .select("serial_no, status")
        .not("serial_no", "is", null)
        .not("status", "in", "(개통완료,판매완료,반품,반납,불량)");
      setExistingSerials(new Set((data ?? []).map((d: any) => d.serial_no).filter(Boolean)));
    })();
    setTimeout(() => inputRef.current?.focus(), 200);
  }, [open, iotMode]);

  const addSerial = (raw: string) => {
    const norm = normalizeSerial(raw);
    if (!norm) return;
    if (list.includes(norm)) {
      toast.warning(`이미 이번 세션에 추가된 일련번호: ${norm}`);
      return;
    }
    if (existingSerials.has(norm)) {
      toast.error(`이미 등록된 재고입니다: ${norm}`);
      return;
    }
    setList((p) => [norm, ...p]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSerial(serialBuf);
      setSerialBuf("");
      // 다음 스캔을 위해 포커스 유지
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const addBulkText = () => {
    const lines = bulkText
      .split(/[\n,;\t]+/)
      .map((s) => normalizeSerial(s))
      .filter(Boolean);
    if (lines.length === 0) return;
    const newOnes: string[] = [];
    const dupSession: string[] = [];
    const dupExisting: string[] = [];
    const seen = new Set(list);
    for (const s of lines) {
      if (seen.has(s)) dupSession.push(s);
      else if (existingSerials.has(s)) dupExisting.push(s);
      else { seen.add(s); newOnes.push(s); }
    }
    if (newOnes.length) setList((p) => [...newOnes, ...p]);
    if (dupSession.length) toast.warning(`중복 ${dupSession.length}건 무시 (세션 내)`);
    if (dupExisting.length) toast.error(`이미 등록된 ${dupExisting.length}건 무시`);
    if (newOnes.length) toast.success(`${newOnes.length}건 추가됨`);
    setBulkText("");
  };

  const remove = (s: string) => setList((p) => p.filter((x) => x !== s));

  const submit = async () => {
    if (!user) return;
    if (!model.trim()) return toast.error("모델명을 먼저 입력하세요");
    if (list.length === 0) return toast.error("등록할 일련번호를 스캔하세요");
    setBusy(true);
    const records = list.map((s) => ({
      model: model.trim(),
      device_kind: kind,
      serial_no: s,
      color: color || null,
      capacity: capacity || null,
      status: "입고",
      stock_in_date: stockInDate || todayISO(),
      purchase_price: Number(purchasePrice) || 0,
      created_by: user.id,
    }));
    const { error } = await supabase.from("device_inventory").insert(records);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${records.length}건 일괄 등록 완료`);
    onDone();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="size-5 text-primary-glow" />
            연속 스캔 등록 (바코드)
          </DialogTitle>
          <DialogDescription>
            상단에서 모델·유형을 1회 선택하고, 일련번호 칸에 바코드를 스캔하면 즉시 추가됩니다.
            (스캐너의 자동 Enter 전송 기능 사용)
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">모델 *</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="예: iPhone 16 Pro" />
          </div>
          <div>
            <Label className="text-xs">재고 유형</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="휴대폰">휴대폰</SelectItem>
                <SelectItem value="IoT(도그마루)">IoT(도그마루)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">입고일</Label>
            <Input type="date" value={stockInDate} onChange={(e) => setStockInDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">색상</Label>
            <Input value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">용량</Label>
            <Input value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">매입가</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="mt-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
          <Label className="text-xs flex items-center gap-1.5 mb-1.5">
            <ScanLine className="size-3.5" /> 일련번호 (IMEI / SN) — 스캔 또는 직접 입력 후 Enter
          </Label>
          <Input
            ref={inputRef}
            value={serialBuf}
            onChange={(e) => setSerialBuf(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="바코드를 스캔하세요…"
            autoComplete="off"
            spellCheck={false}
            maxLength={120}
            className="font-mono text-base h-12"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end">
          <div>
            <Label className="text-xs">또는 일련번호 목록 붙여넣기 (줄바꿈/콤마/탭)</Label>
            <Textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"352099001761481\n352099001761482\n…"}
              className="font-mono text-xs min-h-[72px]"
            />
          </div>
          <Button variant="outline" onClick={addBulkText} disabled={!bulkText.trim()}>
            목록 추가
          </Button>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline" className="bg-primary/10">대기중 {list.length}건</Badge>
            {list.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setList([])}>모두 지우기</Button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-[120px] max-h-[240px] rounded-lg border border-border/40">
          {list.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              스캔/입력된 일련번호가 여기 표시됩니다
            </div>
          ) : (
            <ul className="divide-y divide-border/30">
              {list.map((s) => (
                <li key={s} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="font-mono">{s}</span>
                  <Button size="sm" variant="ghost" onClick={() => remove(s)}>
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            취소
          </Button>
          <Button onClick={submit} disabled={busy || list.length === 0 || !model.trim()}>
            {busy ? <><Loader2 className="size-4 mr-1.5 animate-spin" /> 저장 중…</> : <><CheckCircle2 className="size-4 mr-1.5" /> {list.length}건 일괄 등록</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
