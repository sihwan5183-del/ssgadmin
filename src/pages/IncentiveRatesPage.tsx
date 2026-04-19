import { Header } from "@/components/layout/Header";
import { IncentiveRatesManager } from "@/components/admin/IncentiveRatesManager";
import { useRole } from "@/hooks/useRole";
import { Card } from "@/components/ui/card";
import { Lock } from "lucide-react";

export default function IncentiveRatesPage() {
  const { isAdmin, loading } = useRole();
  if (loading) return <div className="p-10 text-center text-muted-foreground">권한 확인 중...</div>;
  return (
    <div>
      <Header title="인센티브 단가" subtitle="모델·상품·판매유형별 단가와 우선순위를 관리합니다" showScopeToggle={false} />
      {isAdmin ? (
        <IncentiveRatesManager />
      ) : (
        <Card className="p-10 glass text-center max-w-lg mx-auto">
          <Lock className="size-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold text-lg mb-1">관리자 전용</h3>
          <p className="text-sm text-muted-foreground">인센티브 단가는 관리자만 편집할 수 있습니다.</p>
        </Card>
      )}
    </div>
  );
}
