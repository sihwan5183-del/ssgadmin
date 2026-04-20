import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ReactNode } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  itemLabel?: string;
  description?: ReactNode;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  destructive?: boolean;
  confirmLabel?: string;
}

/**
 * 일괄 삭제/처리 1차 확인 다이얼로그.
 * 단순한 "정말로 N건 삭제?" 확인 용도.
 */
export function BulkDeleteDialog({
  open,
  onOpenChange,
  count,
  itemLabel = "건",
  description,
  onConfirm,
  loading,
  destructive = true,
  confirmLabel,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            정말로 선택한 <span className="text-destructive font-bold tabular-nums">{count}</span>{itemLabel} 처리하시겠습니까?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? "이 작업은 되돌릴 수 없습니다."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
          >
            {loading ? "처리 중…" : (confirmLabel ?? "실행")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
