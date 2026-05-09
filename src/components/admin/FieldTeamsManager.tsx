import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Users2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useFieldTeams, type FieldTeam } from "@/hooks/useFieldTeams";
import { SortableList, SortableItem } from "@/components/common/SortableList";

export function FieldTeamsManager() {
  const { user } = useAuth();
  const { rows, refresh } = useFieldTeams();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<FieldTeam | null>(null);
  const [form, setForm] = useState({ name: "", description: "", active: true, sort_order: 0 });

  const reset = () => setForm({ name: "", description: "", active: true, sort_order: 0 });

  const openCreate = () => { setEdit(null); reset(); setOpen(true); };
  const openEdit = (t: FieldTeam) => {
    setEdit(t);
    setForm({
      name: t.name,
      description: t.description ?? "",
      active: t.active,
      sort_order: t.sort_order,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!user) return;
    const name = form.name.trim();
    if (!name) return toast.error("팀 명칭을 입력하세요");
    const payload = {
      name,
      description: form.description.trim() || null,
      active: form.active,
      sort_order: Number(form.sort_order) || 0,
    };
    if (edit) {
      const { error } = await (supabase as any).from("field_teams").update(payload).eq("id", edit.id);
      if (error) return toast.error(error.message);
      toast.success("팀이 수정되었습니다");
    } else {
      const { error } = await (supabase as any)
        .from("field_teams")
        .insert({ ...payload, created_by: user.id });
      if (error) return toast.error(error.message);
      toast.success("팀이 추가되었습니다");
    }
    setOpen(false);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("이 현장 팀을 삭제하시겠습니까?\n(연결된 게시 활동/인입 고객의 팀명은 유지됩니다)")) return;
    const { error } = await (supabase as any).from("field_teams").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("삭제되었습니다");
    refresh();
  };

  const toggleActive = async (t: FieldTeam) => {
    const { error } = await (supabase as any)
      .from("field_teams")
      .update({ active: !t.active })
      .eq("id", t.id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const handleReorder = async (newItems: FieldTeam[]) => {
    const updates = newItems.map((t, idx) =>
      (supabase as any).from("field_teams").update({ sort_order: idx }).eq("id", t.id),
    );
    const results = await Promise.all(updates);
    const failed = results.find((r: any) => r.error);
    if (failed) return toast.error("순서 저장 실패");
    toast.success("순서가 변경되었습니다");
    refresh();
  };

  return (
    <Card className="p-6 glass">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Users2 className="size-4 text-primary" /> 현장 활동 팀 관리
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            기존 지점/팀과 별개로 운영하는 오프라인 현장 전담팀입니다 (예: 현장 1팀, 게시판 전담A조).
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4 mr-1.5" /> 새 팀 추가
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          등록된 현장 팀이 없습니다
        </div>
      ) : (
        <div className="grid gap-2">
          <SortableList items={rows} onReorder={handleReorder}>
            {(t) => (
              <SortableItem
                key={t.id}
                id={t.id}
                className="p-3 rounded-xl border border-border/40 bg-card/40 flex items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium flex items-center gap-2">
                    {t.name}
                    {!t.active && <Badge variant="outline" className="text-muted-foreground">비활성</Badge>}
                  </div>
                  {t.description && (
                    <div className="text-xs text-muted-foreground truncate">{t.description}</div>
                  )}
                </div>
                <Switch checked={t.active} onCheckedChange={() => toggleActive(t)} />
                <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(t.id)}>
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </SortableItem>
            )}
          </SortableList>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{edit ? "현장 팀 수정" : "새 현장 팀"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">팀 명칭 *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: 현장 1팀, 게시판 전담A조"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">설명</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="팀 설명 (선택)"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1 flex-1">
                <Label className="text-xs text-muted-foreground">정렬 순서</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Label className="text-xs text-muted-foreground">활성</Label>
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={save}>{edit ? "수정" : "추가"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}