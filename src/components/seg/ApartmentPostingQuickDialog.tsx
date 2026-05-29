import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const todayStr = () => new Date().toISOString().slice(0, 10);

export function ApartmentPostingQuickDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const [apartmentName, setApartmentName] = useState("");
  const [flyerCount, setFlyerCount] = useState<string>("");
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setApartmentName("");
      setFlyerCount("");
      setStartDate(todayStr());
      setEndDate(todayStr());
    }
  }, [open]);

  const submit = async () => {
    if (!user) return;
    if (!apartmentName.trim()) {
      toast.error("아파트 단지명을 입력해주세요");
      return;
    }
    setBusy(true);
    const flyerNum = Number((flyerCount || "0").replace(/\D+/g, "")) || 0;
    const { error } = await (supabase as any).from("apartment_postings").insert({
      apartment_name: apartmentName.trim(),
      start_date: startDate,
      end_date: endDate,
      created_by: user.id,
      custom_fields: { flyer_count: flyerNum },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("아파트 게시가 등록되었습니다");
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-900">아파트 게시 등록</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-slate-900">
          <div className="space-y-1">
            <Label className="text-xs">아파트 단지명 *</Label>
            <Input
              value={apartmentName}
              onChange={(e) => setApartmentName(e.target.value)}
              placeholder="예: 래미안 1단지"
              maxLength={120}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">전단지 수량</Label>
            <Input
              value={flyerCount}
              onChange={(e) => setFlyerCount(e.target.value.replace(/\D+/g, "").slice(0, 6))}
              placeholder="예: 500"
              inputMode="numeric"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">시작일</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">종료일</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>취소</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "저장 중…" : "저장"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}