import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Inquiry, INQUIRY_STATUSES } from "@/hooks/useInquiries";
import { toast } from "sonner";
import { ArrowRight, Trash2, CheckCircle2, Phone } from "lucide-react";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionBar } from "@/components/common/BulkActionBar";
import { BulkDeleteDialog } from "@/components/common/BulkDeleteDialog";
import { MobileListCard } from "@/components/common/MobileListCard";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  rows: Inquiry[];
  loading: boolean;
  onChange: () => void;
}

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "성공(개통)") return "default";
  if (s === "재케어(예약)") return "secondary";
  if (s === "실패(종결)") return "destructive";
  if (s === "부재") return "outline";
  return "outline";
};

export const InquiryList = ({ rows, loading, onChange }: Props) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [busyId, setBusyId] = useState<string | null>(null);
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const bulk = useBulkSelection<string>(ids);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const updateStatus = async (row: Inquiry, status: string) => {
    setBusyId(row.id);
    const { error } = await supabase.from("inquiries").update({ status }).eq("id", row.id);
    setBusyId(null);
    if (error) {
      toast.error("상태 변경 실패", { description: error.message });
      return;
    }
    if (status === "성공(개통)") {
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

  const bulkDelete = async () => {
    setBulkBusy(true);
    const { error } = await supabase.from("inquiries").delete().in("id", bulk.selectedIds);
    setBulkBusy(false);
    if (error) {
      toast.error("일괄 삭제 실패: " + error.message);
      return;
    }
    toast.success(`${bulk.selectedIds.length}건 삭제됨`);
    setBulkDeleteOpen(false);
    bulk.clear();
    onChange();
  };

  const bulkSetStatus = async (status: string) => {
    const { error } = await supabase.from("inquiries").update({ status }).in("id", bulk.selectedIds);
    if (error) {
      toast.error("일괄 변경 실패: " + error.message);
      return;
    }
    toast.success(`${bulk.selectedIds.length}건 → ${status}`);
    bulk.clear();
    onChange();
  };

  return (
    <>
      {isMobile ? (
        <div className="space-y-2">
          {/* 모바일 헤더: 전체 선택 */}
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <Checkbox
              checked={bulk.allOnPageSelected}
              onCheckedChange={(v) => bulk.togglePage(!!v)}
              className="size-5"
            />
            <span>전체선택 · 총 {rows.length}건</span>
          </div>
          {loading ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">불러오는 중…</Card>
          ) : rows.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">인입 데이터가 없습니다</Card>
          ) : (
            rows.map((r) => (
              <MobileListCard
                key={r.id}
                selected={bulk.isSelected(r.id)}
                onToggleSelect={() => bulk.toggle(r.id)}
                title={
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{r.customer_name ?? "(이름없음)"}</span>
                    <Badge variant={statusVariant(r.status)} className="text-[10px]">{r.status}</Badge>
                  </div>
                }
                meta={
                  <>
                    <Badge variant="outline" className="text-[10px]">{r.channel}</Badge>
                    <span className="tabular-nums">{r.inquiry_date}</span>
                    {r.manager && <span>· {r.manager}</span>}
                  </>
                }
                body={
                  <>
                    {r.phone && (
                      <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-foreground/90 mr-2" onClick={(e) => e.stopPropagation()}>
                        <Phone className="size-3" /> {r.phone}
                      </a>
                    )}
                    {r.content && <span className="block mt-1 line-clamp-2">{r.content}</span>}
                  </>
                }
                actions={
                  <>
                    {r.status !== "성공(개통)" && (
                      <Button size="sm" onClick={() => updateStatus(r, "성공(개통)")} className="h-10 flex-1 min-w-[120px]">
                        실적 등록 <ArrowRight className="size-4 ml-1" />
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => remove(r.id)} className="h-10">
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                }
              />
            ))
          )}
        </div>
      ) : (
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={bulk.allOnPageSelected}
                    onCheckedChange={(v) => bulk.togglePage(!!v)}
                  />
                </TableHead>
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
                <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">불러오는 중…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">인입 데이터가 없습니다</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id} data-state={bulk.isSelected(r.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox checked={bulk.isSelected(r.id)} onCheckedChange={() => bulk.toggle(r.id)} />
                  </TableCell>
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
                    {r.status !== "성공(개통)" && (
                      <Button size="sm" variant="ghost" onClick={() => updateStatus(r, "성공(개통)")} className="h-7 text-xs gap-1">
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
      )}

      <BulkActionBar count={bulk.selectedCount} onClear={bulk.clear}>
        <Select onValueChange={(v) => bulkSetStatus(v)}>
          <SelectTrigger className="h-10 lg:h-8 w-36 text-xs">
            <SelectValue placeholder="상태 일괄 변경" />
          </SelectTrigger>
          <SelectContent>
            {INQUIRY_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)} className="h-10 lg:h-8">
          <Trash2 className="size-4 lg:size-3.5 mr-1" /> 선택 삭제
        </Button>
      </BulkActionBar>

      <BulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        count={bulk.selectedCount}
        itemLabel="건의 인입 데이터를 삭제하시겠습니까?"
        onConfirm={bulkDelete}
        loading={bulkBusy}
        confirmLabel="삭제"
      />
    </>
  );
};
