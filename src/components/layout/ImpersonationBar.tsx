import { useViewScope } from "@/contexts/ViewScopeContext";
import { Button } from "@/components/ui/button";
import { EyeOff, UserCog } from "lucide-react";

/**
 * 매장 임퍼소네이션(읽기 전용 미리보기) 안내 배너
 * - 활성화되면 화면 최상단에 고정 표시
 * - 모든 데이터는 읽기 전용 (UI에서 수정 차단)
 */
export const ImpersonationBar = () => {
  const { impersonation, stopImpersonation } = useViewScope();
  if (!impersonation) return null;

  return (
    <div className="sticky top-0 z-50 w-full bg-gradient-to-r from-primary via-primary-glow to-primary text-primary-foreground shadow-lg">
      <div className="max-w-screen-2xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <UserCog className="size-4" />
          <span>
            <span className="opacity-80 mr-2">매장 뷰 미리보기:</span>
            <span className="font-bold">{impersonation.managerName}</span>
            <span className="ml-3 text-[11px] uppercase tracking-wider opacity-80 px-1.5 py-0.5 rounded bg-primary-foreground/15">
              READ-ONLY
            </span>
          </span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={stopImpersonation}
          className="h-7 gap-1.5 text-xs"
        >
          <EyeOff className="size-3.5" />
          미리보기 종료
        </Button>
      </div>
    </div>
  );
};
