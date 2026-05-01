import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ListPlus, BarChart3, ShieldAlert, RefreshCw, AlertCircle } from "lucide-react";
import { useInquiries } from "@/hooks/useInquiries";
import { usePeriod } from "@/contexts/PeriodContext";
import { useRole } from "@/hooks/useRole";
import { InquiryForm } from "./InquiryForm";
import { InquiryList } from "./InquiryList";
import { InquiryDashboard } from "./InquiryDashboard";
import { PurgeByFilterDialog } from "@/components/common/PurgeByFilterDialog";

export const InquirySection = () => {
  const { startDate, endDate } = usePeriod();
  const { rows, loading, error, refresh } = useInquiries({ startDate, endDate });
  const { isAdmin } = useRole();
  const [purgeOpen, setPurgeOpen] = useState(false);

  return (
    <Tabs defaultValue="list" className="space-y-3">
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="list" className="gap-2"><ListPlus className="size-4" /> 인입 입력·목록</TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-2"><BarChart3 className="size-4" /> 채널별 대시보드</TabsTrigger>
        </TabsList>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => setPurgeOpen(true)}
          >
            <ShieldAlert className="size-4 mr-1.5" /> 기간 전체삭제
          </Button>
        )}
      </div>
      <TabsContent value="list" className="space-y-3">
        <InquiryForm onSaved={refresh} />
        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 flex items-center gap-3">
            <AlertCircle className="size-5 text-destructive shrink-0" />
            <div className="flex-1 text-sm">
              <div className="font-medium text-destructive">데이터를 불러오지 못했습니다.</div>
              <div className="text-xs text-muted-foreground mt-0.5">잠시 후 다시 시도해주세요. ({error})</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => refresh()}>
              <RefreshCw className="size-4 mr-1" /> 새로고침
            </Button>
          </div>
        ) : (
          <InquiryList rows={rows} loading={loading} onChange={refresh} />
        )}
      </TabsContent>
      <TabsContent value="dashboard">
        <InquiryDashboard rows={rows} />
      </TabsContent>

      <PurgeByFilterDialog
        open={purgeOpen}
        onOpenChange={setPurgeOpen}
        filter={{
          table: "inquiries",
          filters: [
            { column: "inquiry_date", op: "gte", value: startDate },
            { column: "inquiry_date", op: "lte", value: endDate },
          ],
          summary: `인입일 ${startDate} ~ ${endDate}`,
        }}
        onDone={refresh}
      />
    </Tabs>
  );
};
