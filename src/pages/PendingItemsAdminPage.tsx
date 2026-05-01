import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowDown,
  ArrowUp,
  ListChecks,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRole } from "@/hooks/useRole";
import {
  usePendingItemDefinitions,
  type PendingItemDefinition,
} from "@/hooks/usePendingItemDefinitions";
import { useAuth } from "@/contexts/AuthContext";

/**
 * 어드민 → 미처리 항목 설정.
 * 실적 입력창/검수창의 [미처리 항목] 체크리스트를 관리.
 */
export default function PendingItemsAdminPage() {
  const { isAdmin, loading: roleLoading } = useRole();
  const { user } = useAuth();
  const { allItems, loading, refresh } = usePendingItemDefinitions();
  const [busy, setBusy] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newRequired, setNewRequired] = useState(false);
  // 수정 모달 상태
  const [editing, setEditing] = useState<PendingItemDefinition | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editSort, setEditSort] = useState<number>(0);
  const [editActive, setEditActive] = useState(true);
  const [editRequired, setEditRequired] = useState(false);
  const [editBusy, setEditBusy] = useState(false);

  const openEdit = (d: PendingItemDefinition) => {
    setEditing(d);
    setEditLabel(d.label);
    setEditSort(d.sort_order);
    setEditActive(d.active);
    setEditRequired(d.required);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const label = editLabel.trim();
    if (!label) {
      toast.error("항목 명칭을 입력하세요");
      return;
    }
    if (
      allItems.some(
        (d) => d.id !== editing.id && d.label === label,
      )
    ) {
      toast.error("이미 동일한 명칭의 항목이 있습니다");
      return;
    }
    setEditBusy(true);
    const { error } = await supabase
      .from("pending_item_definitions")
      .update({
        label,
        sort_order: Number.isFinite(editSort) ? Math.trunc(editSort) : 0,
        active: editActive,
        required: editRequired,
      })
      .eq("id", editing.id);
    setEditBusy(false);
    if (error) {
      toast.error("수정 실패", { description: error.message });
      return;
    }
    toast.success("수정되었습니다");
    setEditing(null);
  };

  // realtime 으로도 들어오지만, 사용자가 페이지 진입 직후 즉시 최신화
  useEffect(() => {
    refresh();
  }, [refresh]);

  const sorted = useMemo(
    () =>
      [...allItems].sort(
        (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label),
      ),
    [allItems],
  );
  const stats = useMemo(() => {
    const total = allItems.length;
    const active = allItems.filter((d) => d.active).length;
    const required = allItems.filter((d) => d.active && d.required).length;
    return { total, active, required };
  }, [allItems]);

  const addItem = async () => {
    const label = newLabel.trim();
    if (!label) {
      toast.error("항목 명칭을 입력하세요");
      return;
    }
    if (allItems.some((d) => d.label === label)) {
      toast.error("이미 동일한 명칭의 항목이 있습니다");
      return;
    }
    setBusy(true);
    const nextSort = (allItems.at(-1)?.sort_order ?? 0) + 10;
    const { error } = await supabase.from("pending_item_definitions").insert({
      label,
      sort_order: nextSort,
      active: true,
      required: newRequired,
      created_by: user?.id ?? null,
    });
    setBusy(false);
    if (error) {
      toast.error("추가 실패", { description: error.message });
      return;
    }
    toast.success("항목이 추가되었습니다");
    setNewLabel("");
    setNewRequired(false);
  };

  const updateItem = async (id: string, patch: Partial<PendingItemDefinition>) => {
    const { error } = await supabase
      .from("pending_item_definitions")
      .update(patch)
      .eq("id", id);
    if (error) {
      toast.error("수정 실패", { description: error.message });
      return;
    }
  };

  const removeItem = async (id: string, label: string) => {
    if (!confirm(`'${label}' 항목을 삭제하시겠습니까?\n(과거 실적에 이미 기록된 라벨은 그대로 보존됩니다)`)) return;
    const { error } = await supabase
      .from("pending_item_definitions")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("삭제 실패", { description: error.message });
      return;
    }
    toast.success("삭제되었습니다");
  };

  /** 두 항목의 sort_order 를 swap — 위/아래 재정렬 */
  const swapOrder = async (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[next];
    await Promise.all([
      supabase.from("pending_item_definitions").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("pending_item_definitions").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
  };

  if (!roleLoading && !isAdmin) {
    return (
      <>
        <Header title="미처리 항목 설정" subtitle="관리자만 접근할 수 있습니다" />
        <Card className="p-6 text-sm text-muted-foreground">
          이 페이지는 관리자 권한이 필요합니다.
        </Card>
      </>
    );
  }

  return (
    <>
      <Header
        title="미처리 항목 설정"
        subtitle="실적 입력창과 검수창의 [미처리 항목] 체크리스트를 직접 관리합니다"
        showPeriodFilter={false}
        showScopeToggle={false}
      />

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        <Card className="p-3 flex items-center gap-2">
          <ListChecks className="size-4 text-primary" />
          <div>
            <div className="text-[10px] text-muted-foreground">전체 항목</div>
            <div className="text-base font-bold tabular-nums">{stats.total}</div>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700">사용중</Badge>
          <div className="text-base font-bold tabular-nums">{stats.active}</div>
        </Card>
        <Card className="p-3 flex items-center gap-2">
          <Star className="size-4 text-amber-500 fill-amber-400" />
          <div>
            <div className="text-[10px] text-muted-foreground">필수 항목</div>
            <div className="text-base font-bold tabular-nums">{stats.required}</div>
          </div>
        </Card>
      </div>

      {/* 신규 추가 */}
      <Card className="p-3 mb-2">
        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,auto] gap-2 items-end">
          <div>
            <Label className="text-xs text-muted-foreground">항목 명칭</Label>
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addItem();
              }}
              placeholder="예: 제휴카드 발급, 중고폰 반납, 부가서비스 유지"
            />
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border/50 bg-card/40">
            <Switch
              id="new-required"
              checked={newRequired}
              onCheckedChange={setNewRequired}
            />
            <Label htmlFor="new-required" className="text-xs cursor-pointer flex items-center gap-1">
              <Star className="size-3 text-amber-500" /> 필수 체크
            </Label>
          </div>
          <Button onClick={addItem} disabled={busy} className="gap-2">
            <Plus className="size-4" /> 추가
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          여기서 추가/수정/삭제한 항목은 실적 입력창과 검수창에 즉시 반영됩니다.
        </p>
      </Card>

      {/* 목록 */}
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20 text-center">정렬</TableHead>
              <TableHead>항목 명칭</TableHead>
              <TableHead className="w-28 text-center">사용</TableHead>
              <TableHead className="w-32 text-center">필수 체크</TableHead>
              <TableHead className="w-20 text-right">삭제</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">불러오는 중…</TableCell>
              </TableRow>
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                  등록된 항목이 없습니다. 위에서 새 항목을 추가하세요.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((d, idx) => (
                <TableRow key={d.id} className={!d.active ? "opacity-50" : undefined}>
                  <TableCell className="text-center">
                    <div className="inline-flex flex-col gap-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        onClick={() => swapOrder(idx, -1)}
                        disabled={idx === 0}
                        aria-label="위로"
                      >
                        <ArrowUp className="size-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        onClick={() => swapOrder(idx, 1)}
                        disabled={idx === sorted.length - 1}
                        aria-label="아래로"
                      >
                        <ArrowDown className="size-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={d.label}
                      onChange={(e) =>
                        // 즉시 로컬 갱신은 realtime 으로 처리, blur 시 저장
                        (d.label = e.target.value)
                      }
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (!v || v === d.label) return;
                        updateItem(d.id, { label: v });
                      }}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={d.active}
                      onCheckedChange={(v) => updateItem(d.id, { active: v })}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="inline-flex items-center gap-1.5">
                      <Switch
                        checked={d.required}
                        onCheckedChange={(v) => updateItem(d.id, { required: v })}
                      />
                      {d.required && <Star className="size-3 text-amber-500 fill-amber-400" />}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => openEdit(d)}
                        aria-label="수정"
                        title="수정"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeItem(d.id, d.label)}
                        aria-label="삭제"
                        title="삭제"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <p className="text-[11px] text-muted-foreground mt-2">
        ※ <Star className="inline size-3 text-amber-500 fill-amber-400 align-text-bottom" /> 필수 체크 항목은
        실적 입력 시 별표로 표시됩니다. 향후 검수 단계에서 [필수 항목 미체크 시 다음 단계 진행 차단] 로직과 연동됩니다.
      </p>

      {/* 수정 모달 */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4" /> 미처리 항목 수정
            </DialogTitle>
            <DialogDescription>
              저장 시 실적 입력창과 검수창에 즉시 반영됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">항목 명칭</Label>
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="예: 제휴카드 발급"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">정렬 순서</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={editSort}
                onChange={(e) => setEditSort(Number(e.target.value))}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                숫자가 작을수록 실적 입력창 체크리스트의 위쪽에 표시됩니다.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border/50 bg-card/40">
                <Label htmlFor="edit-active" className="text-xs cursor-pointer">사용</Label>
                <Switch
                  id="edit-active"
                  checked={editActive}
                  onCheckedChange={setEditActive}
                />
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border/50 bg-card/40">
                <Label htmlFor="edit-required" className="text-xs cursor-pointer flex items-center gap-1">
                  <Star className="size-3 text-amber-500" /> 필수 체크
                </Label>
                <Switch
                  id="edit-required"
                  checked={editRequired}
                  onCheckedChange={setEditRequired}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={editBusy}>
              취소
            </Button>
            <Button onClick={saveEdit} disabled={editBusy}>
              {editBusy ? "저장 중…" : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}