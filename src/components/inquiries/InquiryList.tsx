import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Inquiry } from "@/hooks/useInquiries";
import { useInquiryStatuses } from "@/hooks/useInquiryStatuses";
import { inquiryStatusClass, inquiryStatusSolidClass } from "@/lib/inquiryStatus";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowRight, Trash2, CheckCircle2, Phone, Download } from "lucide-react";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionBar } from "@/components/common/BulkActionBar";
import { BulkDeleteDialog } from "@/components/common/BulkDeleteDialog";
import { MobileListCard } from "@/components/common/MobileListCard";
import { useIsMobile } from "@/hooks/use-mobile";
import { exportInquiriesToExcel } from "@/lib/inquiryExcelExport";
import type { InquiryExcelProfile } from "@/lib/inquiryExcelExport";

interface Props {
  rows: Inquiry[];
  loading: boolean;
  onChange: () => void;
}

export const InquiryList = ({ rows, loading, onChange }: Props) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { statuses } = useInquiryStatuses();
  const [busyId, setBusyId] = useState<string | null>(null);
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const bulk = useBulkSelection<string>(ids);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [latestMemos, setLatestMemos] = useState<Record<string, { content: string; created_at: string }>>({});

  // Fetch the latest memo per inquiry for the visible rows
  useEffect(() => {
    if (ids.length === 0) {
      setLatestMemos({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("inquiry_logs")
        .select("inquiry_id, content, created_at, action")
        .in("inquiry_id", ids)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const map: Record<string, { content: string; created_at: string }> = {};
      (data ?? []).forEach((l: any) => {
        if (map[l.inquiry_id]) return;
        if (l.action !== "메모") return;
        if (!l.content) return;
        map[l.inquiry_id] = { content: l.content, created_at: l.created_at };
      });
      setLatestMemos(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [ids.join(",")]);

  const updateStatus = async (row: Inquiry, status: string) => {
    setBusyId(row.id);
    const { error } = await supabase.from("inquiries").update({ status }).eq("id", row.id);
    setBusyId(null);
    if (error) {
      toast.error("상태 변경 실패", { description: error.message });
      return;
    }
    if (status === "개통완료") {
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
                    <Badge variant="outline" className={cn("text-[10px]", inquiryStatusClass(r.status))}>{r.status}</Badge>
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
                    {r.status !== "개통완료" && (
                      <Button size="sm" onClick={() => updateStatus(r, "개통완료")} className="h-10 flex-1 min-w-[120px]">
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
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 align-middle">
                  <Checkbox
                    checked={bulk.allOnPageSelected}
                    onCheckedChange={(v) => bulk.togglePage(!!v)}
                  />
                </TableHead>
                <TableHead className="w-[88px] align-middle">날짜</TableHead>
                <TableHead className="w-[72px] align-middle">채널</TableHead>
                <TableHead className="w-[200px] align-middle">고객명</TableHead>
                <TableHead className="w-[136px] align-middle whitespace-nowrap">연락처</TableHead>
                <TableHead className="align-middle">상담 히스토리</TableHead>
                <TableHead className="w-[88px] align-middle">담당자</TableHead>
                <TableHead className="w-[120px] align-middle">상태</TableHead>
                <TableHead className="w-[120px] text-right align-middle">액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">불러오는 중…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">인입 데이터가 없습니다</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id} data-state={bulk.isSelected(r.id) ? "selected" : undefined}>
                  <TableCell className="align-middle">
                    <Checkbox checked={bulk.isSelected(r.id)} onCheckedChange={() => bulk.toggle(r.id)} />
                  </TableCell>
                  <TableCell className="text-xs tabular-nums whitespace-nowrap align-middle">{r.inquiry_date}</TableCell>
                  <TableCell className="align-middle">
                    <Badge
                      variant="outline"
                      className="text-[10px] leading-none px-1.5 py-0.5 font-medium rounded-full"
                    >
                      {r.channel}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm align-middle">
                    <span className="truncate">{r.customer_name ?? <span className="text-muted-foreground/50">-</span>}</span>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums whitespace-nowrap align-middle">
                    {r.phone ?? <span className="text-muted-foreground/50">-</span>}
                  </TableCell>
                  <TableCell className="text-xs max-w-xs truncate align-middle" title={r.content ?? ""}>
                    {latestMemos[r.id] ? (
                      <span title={latestMemos[r.id].content} className="block truncate text-foreground/90">
                        {latestMemos[r.id].content}
                      </span>
                    ) : r.content ? (
                      <span title={r.content} className="block truncate text-muted-foreground/70">
                        {r.content}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap align-middle">
                    {r.manager ?? <span className="text-muted-foreground/50">-</span>}
                  </TableCell>
                  <TableCell className="align-middle">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center px-2.5 py-1 rounded-md border text-[11px] font-bold whitespace-nowrap select-none",
                        inquiryStatusSolidClass(r.status),
                      )}
                      title="상태 변경은 상세 보기에서 수행"
                    >
                      {r.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap align-middle">
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
      )}

      <BulkActionBar count={bulk.selectedCount} onClear={bulk.clear}>
        <Select onValueChange={(v) => bulkSetStatus(v)}>
          <SelectTrigger className="h-10 lg:h-8 w-36 text-xs">
            <SelectValue placeholder="상태 일괄 변경" />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
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
