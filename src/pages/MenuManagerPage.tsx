import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Lock, Plus, Trash2, ListTree, Pencil, GripVertical,
} from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, TouchSensor,
  useSensor, useSensors, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useMenuConfig, type MenuGroup, type MenuItem, type MenuRole } from "@/hooks/useMenuConfig";
import { MENU_ICON_NAMES, resolveIcon } from "@/lib/menuIcons";
import { toast } from "sonner";

const ROLE_LABELS: Record<MenuRole, string> = {
  admin: "대표/관리자", manager: "팀장", user: "일반직원",
};
const ALL_ROLES: MenuRole[] = ["admin", "manager", "user"];

function RolesPicker({ value, onChange }: { value: MenuRole[]; onChange: (v: MenuRole[]) => void }) {
  const toggle = (r: MenuRole) => onChange(value.includes(r) ? value.filter((x) => x !== r) : [...value, r]);
  return (
    <div className="flex flex-wrap gap-2">
      {ALL_ROLES.map((r) => (
        <label key={r} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/50 bg-background/40 cursor-pointer text-xs">
          <Checkbox checked={value.includes(r)} onCheckedChange={() => toggle(r)} />
          {ROLE_LABELS[r]}
        </label>
      ))}
    </div>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const Current = resolveIcon(value);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10">
        <span className="flex items-center gap-2"><Current className="size-4" /><SelectValue placeholder="아이콘 선택" /></span>
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {MENU_ICON_NAMES.map((n) => {
          const I = resolveIcon(n);
          return (
            <SelectItem key={n} value={n}>
              <span className="flex items-center gap-2"><I className="size-4" />{n}</span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

interface GroupFormState { id?: string; name: string; icon: string; visible_roles: MenuRole[]; active: boolean; }
interface ItemFormState { id?: string; group_id: string | null; label: string; path: string; icon: string; visible_roles: MenuRole[]; active: boolean; is_admin_only: boolean; }

const UNASSIGNED = "__none__";

// ====== Sortable Item Row ======
function SortableMenuItem({
  it, onEdit, onDelete,
}: { it: MenuItem; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: it.id, data: { type: "item", groupId: it.group_id ?? UNASSIGNED },
  });
  const Icon = resolveIcon(it.icon);
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms ease",
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/40 border border-border/40 hover:border-foreground/30 transition-colors">
      <button type="button" {...attributes} {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing text-foreground/60 hover:text-foreground p-1 -ml-1 rounded"
        aria-label="드래그">
        <GripVertical className="size-4" />
      </button>
      <Icon className="size-4 text-foreground/70 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate text-foreground">{it.label}</span>
          {!it.active && <Badge variant="outline" className="text-[10px]">비활성</Badge>}
          {it.is_admin_only && <Badge variant="outline" className="text-[10px] border-foreground/40">admin</Badge>}
        </div>
        <div className="text-[10px] text-muted-foreground font-mono truncate">
          {it.path} · {it.visible_roles.map((r) => ROLE_LABELS[r]).join(", ")}
        </div>
      </div>
      <Button size="icon" variant="ghost" onClick={onEdit}><Pencil className="size-3.5" /></Button>
      <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="size-3.5 text-destructive" /></Button>
    </div>
  );
}

// ====== Sortable Group Card ======
function SortableGroup({
  g, children, onEdit, onDelete, onAddItem, isEmpty,
}: {
  g: MenuGroup; children: React.ReactNode; onEdit: () => void; onDelete: () => void; onAddItem: () => void; isEmpty: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `g:${g.id}`, data: { type: "group", groupId: g.id },
  });
  // Container droppable so items can be dropped onto empty groups
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `groupbody:${g.id}`, data: { type: "groupbody", groupId: g.id },
  });
  const GroupIcon = resolveIcon(g.icon);
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms ease",
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <Card ref={setNodeRef} style={style} className="glass p-4">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0">
          <button type="button" {...attributes} {...listeners}
            className="touch-none cursor-grab active:cursor-grabbing text-foreground/70 hover:text-foreground p-1 rounded"
            aria-label="그룹 드래그">
            <GripVertical className="size-4" />
          </button>
          <div className="size-9 rounded-lg bg-foreground/5 grid place-items-center shrink-0">
            <GroupIcon className="size-4 text-foreground" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold flex items-center gap-2 text-foreground">
              {g.name}
              {!g.active && <Badge variant="outline" className="text-[10px]">비활성</Badge>}
            </div>
            <div className="text-[11px] text-muted-foreground flex flex-wrap gap-1 mt-0.5">
              {g.visible_roles.map((r) => (
                <Badge key={r} variant="outline" className="text-[10px] border-border/50">{ROLE_LABELS[r]}</Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="icon" variant="ghost" onClick={onAddItem} title="메뉴 추가"><Plus className="size-4" /></Button>
          <Button size="icon" variant="ghost" onClick={onEdit} title="수정"><Pencil className="size-4" /></Button>
          <Button size="icon" variant="ghost" onClick={onDelete} title="삭제"><Trash2 className="size-4 text-destructive" /></Button>
        </div>
      </div>
      <div ref={setDropRef}
        className={`mt-3 space-y-1.5 rounded-lg transition-colors ${isOver ? "ring-2 ring-foreground/30 bg-foreground/5 p-1" : ""}`}>
        {isEmpty && (
          <div className="text-xs text-muted-foreground py-3 px-2">
            등록된 메뉴가 없습니다. 우측 ＋ 버튼으로 추가하거나 다른 그룹의 메뉴를 끌어다 놓으세요.
          </div>
        )}
        {children}
      </div>
    </Card>
  );
}

export default function MenuManagerPage() {
  const { isAdmin, loading: roleLoading } = useRole();
  const { groups, items, refresh, loading } = useMenuConfig();

  // Local mirrors for optimistic DnD
  const [localGroups, setLocalGroups] = useState<MenuGroup[]>([]);
  const [localItems, setLocalItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    setLocalGroups([...groups].sort((a, b) => a.sort_order - b.sort_order));
  }, [groups]);
  useEffect(() => {
    setLocalItems([...items].sort((a, b) => a.sort_order - b.sort_order));
  }, [items]);

  // Forms
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupForm, setGroupForm] = useState<GroupFormState>({
    name: "", icon: "Folder", visible_roles: ["admin", "manager", "user"], active: true,
  });
  const [itemOpen, setItemOpen] = useState(false);
  const [itemForm, setItemForm] = useState<ItemFormState>({
    group_id: null, label: "", path: "/", icon: "Circle",
    visible_roles: ["admin", "manager", "user"], active: true, is_admin_only: false,
  });

  const itemsByGroup = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    localGroups.forEach((g) => map.set(g.id, []));
    map.set(UNASSIGNED, []);
    localItems.forEach((it) => {
      const key = it.group_id ?? UNASSIGNED;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    });
    return map;
  }, [localGroups, localItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [activeDrag, setActiveDrag] = useState<{ type: "item" | "group"; id: string } | null>(null);

  if (roleLoading) return <div className="p-10 text-center text-muted-foreground">권한 확인 중...</div>;
  if (!isAdmin) {
    return (
      <div>
        <Header title="메뉴 설정" subtitle="관리자만 접근 가능합니다" showScopeToggle={false} />
        <Card className="p-10 glass text-center max-w-lg mx-auto">
          <Lock className="size-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold text-lg mb-1">접근 권한이 없습니다</h3>
        </Card>
      </div>
    );
  }

  // ---- Group CRUD ----
  const openNewGroup = () => {
    setGroupForm({ name: "", icon: "Folder", visible_roles: ["admin", "manager", "user"], active: true });
    setGroupOpen(true);
  };
  const openEditGroup = (g: MenuGroup) => {
    setGroupForm({ id: g.id, name: g.name, icon: g.icon, visible_roles: g.visible_roles, active: g.active });
    setGroupOpen(true);
  };
  const saveGroup = async () => {
    if (!groupForm.name.trim()) return toast.error("그룹명을 입력하세요");
    if (groupForm.id) {
      const { error } = await supabase.from("menu_groups").update({
        name: groupForm.name, icon: groupForm.icon, visible_roles: groupForm.visible_roles, active: groupForm.active,
      }).eq("id", groupForm.id);
      if (error) return toast.error(error.message);
    } else {
      const maxSort = Math.max(0, ...groups.map((g) => g.sort_order)) + 10;
      const { error } = await supabase.from("menu_groups").insert({
        name: groupForm.name, icon: groupForm.icon, visible_roles: groupForm.visible_roles, active: groupForm.active, sort_order: maxSort,
      });
      if (error) return toast.error(error.message);
    }
    toast.success("저장되었습니다");
    setGroupOpen(false); refresh();
  };
  const deleteGroup = async (g: MenuGroup) => {
    if (!confirm(`'${g.name}' 그룹을 삭제할까요? 소속 메뉴는 '미분류'로 이동됩니다.`)) return;
    const { error } = await supabase.from("menu_groups").delete().eq("id", g.id);
    if (error) return toast.error(error.message);
    toast.success("삭제되었습니다"); refresh();
  };

  // ---- Item CRUD ----
  const openNewItem = (groupId?: string) => {
    setItemForm({
      group_id: groupId ?? groups[0]?.id ?? null,
      label: "", path: "/", icon: "Circle",
      visible_roles: ["admin", "manager", "user"], active: true, is_admin_only: false,
    });
    setItemOpen(true);
  };
  const openEditItem = (it: MenuItem) => {
    setItemForm({
      id: it.id, group_id: it.group_id, label: it.label, path: it.path, icon: it.icon,
      visible_roles: it.visible_roles, active: it.active, is_admin_only: it.is_admin_only,
    });
    setItemOpen(true);
  };
  const saveItem = async () => {
    if (!itemForm.label.trim() || !itemForm.path.trim()) return toast.error("라벨과 경로를 입력하세요");
    if (itemForm.id) {
      const { error } = await supabase.from("menu_items").update({
        group_id: itemForm.group_id, label: itemForm.label, path: itemForm.path, icon: itemForm.icon,
        visible_roles: itemForm.visible_roles, active: itemForm.active, is_admin_only: itemForm.is_admin_only,
      }).eq("id", itemForm.id);
      if (error) return toast.error(error.message);
    } else {
      const siblings = items.filter((i) => i.group_id === itemForm.group_id);
      const maxSort = Math.max(0, ...siblings.map((i) => i.sort_order)) + 10;
      const { error } = await supabase.from("menu_items").insert({ ...itemForm, sort_order: maxSort });
      if (error) return toast.error(error.message);
    }
    toast.success("저장되었습니다");
    setItemOpen(false); refresh();
  };
  const deleteItem = async (it: MenuItem) => {
    if (!confirm(`'${it.label}' 메뉴를 삭제할까요?`)) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", it.id);
    if (error) return toast.error(error.message);
    refresh();
  };

  // ---- DnD handlers ----
  const findItemContainer = (id: string): string | null => {
    const it = localItems.find((x) => x.id === id);
    if (!it) return null;
    return it.group_id ?? UNASSIGNED;
  };

  const handleDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    if (id.startsWith("g:")) setActiveDrag({ type: "group", id: id.slice(2) });
    else setActiveDrag({ type: "item", id });
  };

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId.startsWith("g:")) return; // groups don't cross containers

    const activeContainer = findItemContainer(activeId);
    let overContainer: string | null = null;
    if (overId.startsWith("groupbody:")) overContainer = overId.slice("groupbody:".length);
    else overContainer = findItemContainer(overId);
    if (!activeContainer || !overContainer) return;
    if (activeContainer === overContainer) return;

    setLocalItems((prev) => {
      const next = [...prev];
      const idx = next.findIndex((i) => i.id === activeId);
      if (idx < 0) return prev;
      const moved = { ...next[idx], group_id: overContainer === UNASSIGNED ? null : overContainer };
      next.splice(idx, 1);
      // insert at end of overContainer or before the over item
      let insertAt = next.length;
      if (!overId.startsWith("groupbody:")) {
        const overIdx = next.findIndex((i) => i.id === overId);
        if (overIdx >= 0) insertAt = overIdx;
      }
      next.splice(insertAt, 0, moved);
      return next;
    });
  };

  const persistGroupsOrder = async (arr: MenuGroup[]) => {
    const updates = arr.map(async (g, idx) =>
      await supabase.from("menu_groups").update({ sort_order: idx * 10 }).eq("id", g.id),
    );
    const results = await Promise.all(updates);
    const failed = results.find((r: any) => r.error);
    if (failed) toast.error("그룹 순서 저장 실패");
    else toast.success("순서가 변경되었습니다");
    refresh();
  };

  const persistItemsForGroups = async (groupIds: string[], itemList: MenuItem[]) => {
    const ops: Promise<any>[] = [];
    for (const gid of groupIds) {
      const list = itemList.filter((it) => (it.group_id ?? UNASSIGNED) === gid);
      list.forEach((it, idx) => {
        ops.push(
          (async () =>
            await supabase.from("menu_items").update({
              sort_order: idx * 10,
              group_id: gid === UNASSIGNED ? null : gid,
            }).eq("id", it.id))(),
        );
      });
    }
    const results = await Promise.all(ops);
    const failed = results.find((r: any) => r.error);
    if (failed) toast.error("순서 저장 실패");
    else toast.success("순서가 변경되었습니다");
    refresh();
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveDrag(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // Group reorder
    if (activeId.startsWith("g:") && overId.startsWith("g:")) {
      const aId = activeId.slice(2), oId = overId.slice(2);
      const oldIdx = localGroups.findIndex((g) => g.id === aId);
      const newIdx = localGroups.findIndex((g) => g.id === oId);
      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;
      const next = arrayMove(localGroups, oldIdx, newIdx);
      setLocalGroups(next);
      persistGroupsOrder(next);
      return;
    }

    if (activeId.startsWith("g:")) return;

    // Item reorder/move
    const activeContainer = findItemContainer(activeId);
    let overContainer: string | null = null;
    if (overId.startsWith("groupbody:")) overContainer = overId.slice("groupbody:".length);
    else overContainer = findItemContainer(overId);
    if (!activeContainer || !overContainer) return;

    let nextItems = localItems;
    if (activeContainer === overContainer && !overId.startsWith("groupbody:") && activeId !== overId) {
      const containerItems = localItems.filter((i) => (i.group_id ?? UNASSIGNED) === activeContainer);
      const oldIdx = containerItems.findIndex((i) => i.id === activeId);
      const newIdx = containerItems.findIndex((i) => i.id === overId);
      if (oldIdx >= 0 && newIdx >= 0 && oldIdx !== newIdx) {
        const reordered = arrayMove(containerItems, oldIdx, newIdx);
        const others = localItems.filter((i) => (i.group_id ?? UNASSIGNED) !== activeContainer);
        nextItems = [...others, ...reordered];
        setLocalItems(nextItems);
      }
    }
    persistItemsForGroups(
      Array.from(new Set([activeContainer, overContainer])),
      nextItems,
    );
  };

  const sortedGroupIds = localGroups.map((g) => `g:${g.id}`);

  return (
    <div>
      <Header title="메뉴 설정"
        subtitle="드래그로 순서 변경 · 메뉴를 다른 그룹으로 끌어 옮길 수 있습니다"
        showScopeToggle={false} />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-foreground/70">
          <ListTree className="size-4 text-foreground" />
          {loading ? "불러오는 중…" : `${groups.length}개 그룹 · ${items.length}개 메뉴`}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openNewItem()}>
            <Plus className="size-4 mr-1" /> 메뉴 추가
          </Button>
          <Button onClick={openNewGroup}>
            <Plus className="size-4 mr-1" /> 그룹 추가
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDrag(null)}>
        <SortableContext items={sortedGroupIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {localGroups.map((g) => {
              const groupItems = itemsByGroup.get(g.id) ?? [];
              return (
                <SortableGroup key={g.id} g={g}
                  isEmpty={groupItems.length === 0}
                  onEdit={() => openEditGroup(g)}
                  onDelete={() => deleteGroup(g)}
                  onAddItem={() => openNewItem(g.id)}>
                  <SortableContext items={groupItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    {groupItems.map((it) => (
                      <SortableMenuItem key={it.id} it={it}
                        onEdit={() => openEditItem(it)}
                        onDelete={() => deleteItem(it)} />
                    ))}
                  </SortableContext>
                </SortableGroup>
              );
            })}
          </div>
        </SortableContext>

        {/* Unassigned */}
        {(itemsByGroup.get(UNASSIGNED)?.length ?? 0) > 0 && (
          <Card className="glass p-4 border-dashed mt-4">
            <div className="font-semibold text-sm mb-3 text-foreground/70">미분류 메뉴</div>
            <UnassignedDroppable>
              <SortableContext
                items={(itemsByGroup.get(UNASSIGNED) ?? []).map((i) => i.id)}
                strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {(itemsByGroup.get(UNASSIGNED) ?? []).map((it) => (
                    <SortableMenuItem key={it.id} it={it}
                      onEdit={() => openEditItem(it)}
                      onDelete={() => deleteItem(it)} />
                  ))}
                </div>
              </SortableContext>
            </UnassignedDroppable>
          </Card>
        )}

        <DragOverlay>
          {activeDrag?.type === "item" && (() => {
            const it = localItems.find((x) => x.id === activeDrag.id);
            if (!it) return null;
            const Icon = resolveIcon(it.icon);
            return (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-foreground/40 shadow-xl">
                <GripVertical className="size-4 text-foreground/60" />
                <Icon className="size-4 text-foreground/70" />
                <span className="font-medium text-sm text-foreground">{it.label}</span>
              </div>
            );
          })()}
          {activeDrag?.type === "group" && (() => {
            const g = localGroups.find((x) => x.id === activeDrag.id);
            if (!g) return null;
            const GIcon = resolveIcon(g.icon);
            return (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-card border border-foreground/40 shadow-xl">
                <GripVertical className="size-4 text-foreground/60" />
                <GIcon className="size-4 text-foreground" />
                <span className="font-semibold text-foreground">{g.name}</span>
              </div>
            );
          })()}
        </DragOverlay>
      </DndContext>

      {/* ===== Group Dialog ===== */}
      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{groupForm.id ? "그룹 수정" : "새 그룹"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">그룹명</Label>
              <Input value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                placeholder="예) 영업 관리" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">아이콘</Label>
              <div className="mt-1">
                <IconPicker value={groupForm.icon}
                  onChange={(v) => setGroupForm({ ...groupForm, icon: v })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">노출 권한</Label>
              <div className="mt-2">
                <RolesPicker value={groupForm.visible_roles}
                  onChange={(v) => setGroupForm({ ...groupForm, visible_roles: v })} />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/40">
              <div>
                <div className="text-sm font-medium">활성 상태</div>
                <div className="text-[11px] text-muted-foreground">끄면 사이드바에서 숨겨집니다</div>
              </div>
              <Switch checked={groupForm.active}
                onCheckedChange={(v) => setGroupForm({ ...groupForm, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupOpen(false)}>취소</Button>
            <Button onClick={saveGroup}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Item Dialog ===== */}
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{itemForm.id ? "메뉴 수정" : "새 메뉴"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">소속 그룹</Label>
              <Select value={itemForm.group_id ?? UNASSIGNED}
                onValueChange={(v) => setItemForm({ ...itemForm, group_id: v === UNASSIGNED ? null : v })}>
                <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>미분류</SelectItem>
                  {groups.map((g) => (<SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">라벨</Label>
                <Input value={itemForm.label}
                  onChange={(e) => setItemForm({ ...itemForm, label: e.target.value })}
                  placeholder="예) 실적 입력" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">경로(URL)</Label>
                <Input value={itemForm.path}
                  onChange={(e) => setItemForm({ ...itemForm, path: e.target.value })}
                  placeholder="/input" className="mt-1 font-mono" />
              </div>
            </div>
            <div>
              <Label className="text-xs">아이콘</Label>
              <div className="mt-1">
                <IconPicker value={itemForm.icon}
                  onChange={(v) => setItemForm({ ...itemForm, icon: v })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">노출 권한</Label>
              <div className="mt-2">
                <RolesPicker value={itemForm.visible_roles}
                  onChange={(v) => setItemForm({ ...itemForm, visible_roles: v })} />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/40">
              <div>
                <div className="text-sm font-medium">관리자 전용 표시</div>
                <div className="text-[11px] text-muted-foreground">'admin' 배지가 함께 표시됩니다</div>
              </div>
              <Switch checked={itemForm.is_admin_only}
                onCheckedChange={(v) => setItemForm({ ...itemForm, is_admin_only: v })} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/40">
              <div>
                <div className="text-sm font-medium">활성 상태</div>
                <div className="text-[11px] text-muted-foreground">끄면 사이드바에서 숨겨집니다</div>
              </div>
              <Switch checked={itemForm.active}
                onCheckedChange={(v) => setItemForm({ ...itemForm, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemOpen(false)}>취소</Button>
            <Button onClick={saveItem}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UnassignedDroppable({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `groupbody:${UNASSIGNED}`, data: { type: "groupbody", groupId: UNASSIGNED },
  });
  return (
    <div ref={setNodeRef}
      className={`rounded-lg transition-colors ${isOver ? "ring-2 ring-foreground/30 bg-foreground/5 p-1" : ""}`}>
      {children}
    </div>
  );
}
