import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

/**
 * 모바일 햄버거 트리거 + 좌측 슬라이드 시트.
 * 시트 안에는 기존 Sidebar 컴포넌트를 그대로 재사용한다.
 * (Sidebar 자체는 hidden lg:flex 이지만, Sheet 내부에서는 강제로 보이게 wrapper로 처리)
 */
export const MobileSidebar = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // 라우트 이동 시 자동 닫기
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="메뉴 열기"
          className="lg:hidden inline-flex items-center justify-center size-11 rounded-xl glass border border-border/40 active:scale-95 transition-transform"
        >
          <Menu className="size-5 text-foreground" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="p-0 w-[17rem] max-w-[85vw] border-r border-border/40 [&>button]:hidden"
      >
        {/* Sidebar 자체가 hidden lg:flex 이므로 강제로 보이게 wrapper 적용 */}
        <div className="h-full mobile-sidebar-wrapper">
          <Sidebar />
        </div>
      </SheetContent>
    </Sheet>
  );
};
