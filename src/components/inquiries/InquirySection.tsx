import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListPlus, BarChart3 } from "lucide-react";
import { useInquiries } from "@/hooks/useInquiries";
import { usePeriod } from "@/contexts/PeriodContext";
import { InquiryForm } from "./InquiryForm";
import { InquiryList } from "./InquiryList";
import { InquiryDashboard } from "./InquiryDashboard";

export const InquirySection = () => {
  const { startDate, endDate } = usePeriod();
  const { rows, loading, refresh } = useInquiries({ startDate, endDate });

  return (
    <Tabs defaultValue="list" className="space-y-3">
      <TabsList>
        <TabsTrigger value="list" className="gap-2"><ListPlus className="size-4" /> 인입 입력·목록</TabsTrigger>
        <TabsTrigger value="dashboard" className="gap-2"><BarChart3 className="size-4" /> 채널별 대시보드</TabsTrigger>
      </TabsList>
      <TabsContent value="list" className="space-y-3">
        <InquiryForm onSaved={refresh} />
        <InquiryList rows={rows} loading={loading} onChange={refresh} />
      </TabsContent>
      <TabsContent value="dashboard">
        <InquiryDashboard rows={rows} />
      </TabsContent>
    </Tabs>
  );
};
