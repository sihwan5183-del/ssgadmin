import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Inquiry, INQUIRY_STATUSES } from "@/hooks/useInquiries";
import { toast } from "sonner";
import { ArrowRight, Trash2 } from "lucide-react";

interface Props {
  rows: Inquiry[];
  loading: boolean;
  onChange: () => void;
}

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "개통완료") return "default";
  if (s === "방문예약") return "secondary";
  if (s === "종료") return "destructive";
  return "outline";
};

export const InquiryList = ({ rows, loading, onChange }: Props) => {
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);

  const updateStatus = async (row: Inquiry, status: string) => {
    setBusyId(row.id);
    const { error } = await supabase.from("inquiries").update({ status }).eq("id", row.id);
    setBusyId(null);
    if (error) {
      toast.error("상태 변경 실패", { description: error.message });
      return;
    }
    if (status === "개통완료") {
      // 자동 채움을 위해 InputPage로 이동
      const params = new URLSearchParams({
        from_inquiry: row.id,
        customer_name: row.customer_name ?? "",
        phone: row.phone ?? "",
        channel: row.channel,
        manager: row.manager ?? "",
      });
      toast.success("실적 입력으로 이동합니다");
      navigate(`/input?${params.toString()}`);
      return;
    }
    toast.success("상태 변경 완료");
    onChange();
  };

  const remove = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const { error } = await supabase.from("inquiries").delete().eq("id", id);
    if (error) {
      toast.error("삭제 실패", { description: error.message });
      return;
    }
    toast.success("삭제 완료");
    onChange();
  };

  return (
    <Card className="p-0 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">날짜</TableHead>
            <TableHead className="w-28">채널</TableHead>
            <TableHead>고객명</TableHead>
            <TableHead className="w-32">연락처</TableHead>
            <TableHead>문의내용</TableHead>
            <TableHead className="w-24">담당자</TableHead>
            <TableHead className="w-32">상태</TableHead>
            <TableHead className="w-32 text-right">액션</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">불러오는 중…</TableCell></TableRow>
          ) : rows.length === 0 ? (
            <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">인입 데이터가 없습니다</TableCell></TableRow>
          ) : rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-xs">{r.inquiry_date}</TableCell>
              <TableCell><Badge variant="outline">{r.channel}</Badge></TableCell>
              <TableCell className="text-sm">{r.customer_name ?? "-"}</TableCell>
              <TableCell className="text-xs">{r.phone ?? "-"}</TableCell>
              <TableCell className="text-xs max-w-xs truncate" title={r.content ?? ""}>{r.content ?? "-"}</TableCell>
              <TableCell className="text-xs">{r.manager ?? "-"}</TableCell>
              <TableCell>
                <Select value={r.status} onValueChange={(v) => updateStatus(r, v)} disabled={busyId === r.id || !!r.converted_sale_id}>
                  <SelectTrigger className="h-8 text-xs">
                    <Badge variant={statusVariant(r.status)} className="text-xs">{r.status}</Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {INQUIRY_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-right">
                {r.status !== "개통완료" && (
                  <Button size="sm" variant="ghost" onClick={() => updateStatus(r, "개통완료")} className="h-7 text-xs gap-1">
                    실적등록 <ArrowRight className="size-3" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => remove(r.id)} className="h-7 w-7">
                  <Trash2 className="size-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};
