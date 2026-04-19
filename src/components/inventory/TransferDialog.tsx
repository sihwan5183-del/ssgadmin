import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStores } from "@/hooks/useStores";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deviceId: string;
  deviceLabel: string;
  fromStoreId: string | null;
  onCreated?: () => void;
}

export const TransferDialog = ({
  open,
  onOpenChange,
  deviceId,
  deviceLabel,
  fromStoreId,
  onCreated,
}: Props) => {
  const { stores, byId } = useStores();
  const { user } = useAuth();
  const [toStore, setToStore] = useState<string>("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!toStore) return toast.error("도착 매장을 선택하세요");
    if (toStore === fromStoreId) return toast.error("같은 매장으로는 이동할 수 없습니다");
    setBusy(true);
    const { error } = await supabase.from("device_transfers").insert({
      device_id: deviceId,
      from_store_id: fromStoreId,
      to_store_id: toStore,
      reason: reason || null,
      requested_by: user.id,
      status: "pending",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("이동 요청이 접수되었습니다 (관리자 승인 대기)");
    onOpenChange(false);
    setToStore("");
    setReason("");
    onCreated?.();
  };

  const fromName = byId(fromStoreId)?.name ?? "(미지정)";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>매장 이동 요청</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm">
            <span className="text-muted-foreground">단말기:</span>{" "}
            <span className="font-medium">{deviceLabel}</span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
            <span className="text-sm font-medium">{fromName}</span>
            <ArrowRight className="size-4 text-primary-glow" />
            <Select value={toStore} onValueChange={setToStore}>
              <SelectTrigger className="h-9 flex-1">
                <SelectValue placeholder="도착 매장 선택" />
              </SelectTrigger>
              <SelectContent>
                {stores
                  .filter((s) => s.active && s.id !== fromStoreId)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">사유 (선택)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 본점 재고 부족" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={submit} disabled={busy || !toStore}>
            {busy ? "전송 중…" : "이동 요청"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
