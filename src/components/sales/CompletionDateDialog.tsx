import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Props {
  open: boolean;
  targetStatus: string; // "개통완료" | "설치완료"
  customerName?: string | null;
  onConfirm: (isoDate: string) => Promise<void> | void;
  onCancel: () => void;
}

const todayIso = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export function CompletionDateDialog({
  open,
  targetStatus,
  customerName,
  onConfirm,
  onCancel,
}: Props) {
  const [date, setDate] = useState<Date>(todayIso());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(todayIso());
      setSaving(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!date) return;
    setSaving(true);
    try {
      await onConfirm(format(date, "yyyy-MM-dd"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !saving) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-[400px] rounded-2xl shadow-2xl bg-white text-slate-900 border border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-slate-900 text-base font-bold">
            최종 완료 처리 (개통일자 지정)
          </DialogTitle>
          <DialogDescription className="text-slate-600 text-xs">
            {customerName ? `${customerName} · ` : ""}
            상태를 <b className="text-slate-900">{targetStatus}</b>로 변경합니다.
            개통일자를 확인해 주세요.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-medium text-slate-900 rounded-xl h-12 bg-slate-50 border-slate-200 hover:bg-slate-100",
                )}
              >
                <CalendarIcon className="mr-2 size-4 text-slate-500" />
                {format(date, "yyyy년 MM월 dd일 (E)")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <p className="mt-2 text-[11px] text-slate-500">
            기본값은 오늘 날짜입니다. 필요 시 달력에서 변경하세요.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl"
          >
            취소
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || !date}
            className="rounded-xl bg-slate-900 text-white hover:bg-slate-800"
          >
            {saving ? "저장 중…" : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
