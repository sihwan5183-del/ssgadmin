import { Header } from "@/components/layout/Header";
import { DeviceModelsManager } from "@/components/admin/DeviceModelsManager";
import { useRole } from "@/hooks/useRole";
import { Card } from "@/components/ui/card";
import { Lock } from "lucide-react";

export default function DeviceModelsPage() {
  const { isAdmin, loading } = useRole();
  if (loading) return <div className="p-10 text-center text-muted-foreground">권한 확인 중...</div>;
  return (
    <div>
      <Header title="모델 마스터" subtitle="펫네임·공식명·유사어를 등록해 입력 데이터를 자동 통합합니다" showScopeToggle={false} />
      {isAdmin ? (
        <DeviceModelsManager />
      ) : (
        <Card className="p-10 glass text-center max-w-lg mx-auto">
          <Lock className="size-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold text-lg mb-1">관리자 전용</h3>
          <p className="text-sm text-muted-foreground">모델 마스터는 관리자만 편집할 수 있습니다.</p>
        </Card>
      )}
    </div>
  );
}
