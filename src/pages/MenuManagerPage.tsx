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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowDown,
  ArrowUp,
  Lock,
  Plus,
  Trash2,
  ListTree,
  Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useMenuConfig, type MenuGroup, type MenuItem, type MenuRole } from "@/hooks/useMenuConfig";
import { MENU_ICON_NAMES, resolveIcon } from "@/lib/menuIcons";
import { toast } from "sonner";

const ROLE_LABELS: Record<MenuRole, string> = {
  admin: "대표/관리자",
  manager: "팀장",
  user: "일반직원",
};
const ALL_ROLES: MenuRole[] = ["admin", "manager", "user"];

function RolesPicker({
  value,
  onChange,
}: {
  value: MenuRole[];
  onChange: (v: MenuRole[]) => void;
}) {
  const toggle = (r: MenuRole) =>
    onChange(value.includes(r) ? value.filter((x) => x !== r) : [...value, r]);
  return (
    <div className="flex flex-wrap gap-2">
      {ALL_ROLES.map((r) => (
        <label
          key={r}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/50 bg-background/40 cursor-pointer text-xs"
        >
          <Checkbox
            checked={value.includes(r)}
            onCheckedChange={() => toggle(r)}
          />
          {ROLE_LABELS[r]}
        </label>
      ))}
    </div>
  );
}

function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const Current = resolveIcon(value);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10">
        <span className="flex items-center gap-2">
          <Current className="size-4" />
          <SelectValue placeholder="아이콘 선택" />
        </span>
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {MENU_ICON_NAMES.map((n) => {
          const I = resolveIcon(n);
          return (
            <SelectItem key={n} value={n}>
              <span className="flex items-center gap-2">
                <I className="size-4" />
                {n}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

interface GroupFormState {
  id?: string;
  name: string;
  icon: string;
  visible_roles: MenuRole[];
  active: boolean;
}
interface ItemFormState {
  id?: string;
  group_id: string | null;
  label: string;
  path: string;
  icon: string;
  visible_roles: MenuRole[];
  active: boolean;
  is_admin_only: boolean;
}

export default function MenuManagerPage() {
  const { isAdmin, loading: roleLoading } = useRole();
  const { groups, items, refresh, loading } = useMenuConfig();

  // Group form
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupForm, setGroupForm] = useState<GroupFormState>({
    name: "",
    icon: "Folder",
    visible_roles: ["admin", "manager", "user"],
    active: true,
  });

  // Item form
  const [itemOpen, setItemOpen] = useState(false);
  const [itemForm, setItemForm] = useState<ItemFormState>({
    group_id: null,
    label: "",
    path: "/",
    icon: "Circle",
    visible_roles: ["admin", "manager", "user"],
    active: true,
    is_admin_only: false,
  });

  const itemsByGroup = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    items.forEach((it) => {
      const key = it.group_id ?? "__none__";
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    });
    map.forEach((v) => v.sort((a, b) => a.sort_order - b.sort_order));
    return map;
  }, [items]);

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

  // ============ Group ops ============
  const openNewGroup = () => {
    setGroupForm({
      name: "",
      icon: "Folder",
      visible_roles: ["admin", "manager", "user"],
      active: true,
    });
    setGroupOpen(true);
  };
  const openEditGroup = (g: MenuGroup) => {
    setGroupForm({
      id: g.id,
      name: g.name,
      icon: g.icon,
      visible_roles: g.visible_roles,
      active: g.active,
    });
    setGroupOpen(true);
  };
  const saveGroup = async () => {
    if (!groupForm.name.trim()) return toast.error("그룹명을 입력하세요");
    if (groupForm.id) {
      const { error } = await supabase
        .from("menu_groups")
        .update({
          name: groupForm.name,
          icon: groupForm.icon,
          visible_roles: groupForm.visible_roles,
          active: groupForm.active,
        })
        .eq("id", groupForm.id);
      if (error) return toast.error(error.message);
    } else {
      const maxSort = Math.max(0, ...groups.map((g) => g.sort_order)) + 10;
      const { error } = await supabase.from("menu_groups").insert({
        name: groupForm.name,
        icon: groupForm.icon,
        visible_roles: groupForm.visible_roles,
        active: groupForm.active,
        sort_order: maxSort,
      });
      if (error) return toast.error(error.message);
    }
    toast.success("저장되었습니다");
    setGroupOpen(false);
    refresh();
  };
  const deleteGroup = async (g: MenuGroup) => {
    if (!confirm(`'${g.name}' 그룹을 삭제할까요? 소속 메뉴는 '미분류'로 이동됩니다.`)) return;
    const { error } = await supabase.from("menu_groups").delete().eq("id", g.id);
    if (error) return toast.error(error.message);
    toast.success("삭제되었습니다");
    refresh();
  };
  const moveGroup = async (g: MenuGroup, dir: -1 | 1) => {
    const sorted = [...groups].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((x) => x.id === g.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("menu_groups").update({ sort_order: swap.sort_order }).eq("id", g.id),
      supabase.from("menu_groups").update({ sort_order: g.sort_order }).eq("id", swap.id),
    ]);
    refresh();
  };

  // ============ Item ops ============
  const openNewItem = (groupId?: string) => {
    setItemForm({
      group_id: groupId ?? groups[0]?.id ?? null,
      label: "",
      path: "/",
      icon: "Circle",
      visible_roles: ["admin", "manager", "user"],
      active: true,
      is_admin_only: false,
    });
    setItemOpen(true);
  };
  const openEditItem = (it: MenuItem) => {
    setItemForm({
      id: it.id,
      group_id: it.group_id,
      label: it.label,
      path: it.path,
      icon: it.icon,
      visible_roles: it.visible_roles,
      active: it.active,
      is_admin_only: it.is_admin_only,
    });
    setItemOpen(true);
  };
  const saveItem = async () => {
    if (!itemForm.label.trim() || !itemForm.path.trim()) return toast.error("라벨과 경로를 입력하세요");
    if (itemForm.id) {
      const { error } = await supabase
        .from("menu_items")
        .update({
          group_id: itemForm.group_id,
          label: itemForm.label,
          path: itemForm.path,
          icon: itemForm.icon,
          visible_roles: itemForm.visible_roles,
          active: itemForm.active,
          is_admin_only: itemForm.is_admin_only,
        })
        .eq("id", itemForm.id);
      if (error) return toast.error(error.message);
    } else {
      const siblings = items.filter((i) => i.group_id === itemForm.group_id);
      const maxSort = Math.max(0, ...siblings.map((i) => i.sort_order)) + 10;
      const { error } = await supabase.from("menu_items").insert({
        ...itemForm,
        sort_order: maxSort,
      });
      if (error) return toast.error(error.message);
    }
    toast.success("저장되었습니다");
    setItemOpen(false);
    refresh();
  };
  const deleteItem = async (it: MenuItem) => {
    if (!confirm(`'${it.label}' 메뉴를 삭제할까요?`)) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", it.id);
    if (error) return toast.error(error.message);
    refresh();
  };
  const moveItem = async (it: MenuItem, dir: -1 | 1) => {
    const siblings = (itemsByGroup.get(it.group_id ?? "__none__") ?? []);
    const idx = siblings.findIndex((x) => x.id === it.id);
    const swap = siblings[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("menu_items").update({ sort_order: swap.sort_order }).eq("id", it.id),
      supabase.from("menu_items").update({ sort_order: it.sort_order }).eq("id", swap.id),
    ]);
    refresh();
  };

  return (
    <div>
      <Header
        title="메뉴 설정"
        subtitle="사이드바 대분류·소분류·노출 권한·아이콘을 직접 관리합니다"
        showScopeToggle={false}
      />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ListTree className="size-4 text-primary-glow" />
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

      <div className="space-y-4">
        {[...groups]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((g) => {
            const GroupIcon = resolveIcon(g.icon);
            const groupItems = itemsByGroup.get(g.id) ?? [];
            return (
              <Card key={g.id} className="glass p-4">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-lg bg-primary/10 grid place-items-center shrink-0">
                      <GroupIcon className="size-4 text-primary-glow" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold flex items-center gap-2">
                        {g.name}
                        {!g.active && (
                          <Badge variant="outline" className="text-[10px]">비활성</Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex flex-wrap gap-1 mt-0.5">
                        {g.visible_roles.map((r) => (
                          <Badge key={r} variant="outline" className="text-[10px] border-border/50">
                            {ROLE_LABELS[r]}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => moveGroup(g, -1)} title="위로">
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => moveGroup(g, 1)} title="아래로">
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openNewItem(g.id)} title="메뉴 추가">
                      <Plus className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEditGroup(g)} title="수정">
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteGroup(g)} title="삭제">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  {groupItems.length === 0 && (
                    <div className="text-xs text-muted-foreground py-3 px-2">
                      등록된 메뉴가 없습니다. 우측 ＋ 버튼으로 추가하세요.
                    </div>
                  )}
                  {groupItems.map((it) => {
                    const Icon = resolveIcon(it.icon);
                    return (
                      <div
                        key={it.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-background/40 border border-border/40"
                      >
                        <Icon className="size-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{it.label}</span>
                            {!it.active && (
                              <Badge variant="outline" className="text-[10px]">비활성</Badge>
                            )}
                            {it.is_admin_only && (
                              <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                                admin
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono truncate">
                            {it.path} · {it.visible_roles.map((r) => ROLE_LABELS[r]).join(", ")}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button size="icon" variant="ghost" onClick={() => moveItem(it, -1)}>
                            <ArrowUp className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => moveItem(it, 1)}>
                            <ArrowDown className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => openEditItem(it)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteItem(it)}>
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}

        {/* Unassigned items */}
        {(itemsByGroup.get("__none__")?.length ?? 0) > 0 && (
          <Card className="glass p-4 border-dashed">
            <div className="font-semibold text-sm mb-3 text-muted-foreground">미분류 메뉴</div>
            <div className="space-y-1.5">
              {itemsByGroup.get("__none__")!.map((it) => (
                <div key={it.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-background/40 border border-border/40">
                  <span className="flex-1 text-sm">{it.label} <span className="text-[10px] text-muted-foreground font-mono ml-1">{it.path}</span></span>
                  <Button size="sm" variant="ghost" onClick={() => openEditItem(it)}>그룹 지정</Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteItem(it)}>
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* ===== Group Dialog ===== */}
      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{groupForm.id ? "그룹 수정" : "새 그룹"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">그룹명</Label>
              <Input
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                placeholder="예) 영업 관리"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">아이콘</Label>
              <div className="mt-1">
                <IconPicker
                  value={groupForm.icon}
                  onChange={(v) => setGroupForm({ ...groupForm, icon: v })}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">노출 권한</Label>
              <div className="mt-2">
                <RolesPicker
                  value={groupForm.visible_roles}
                  onChange={(v) => setGroupForm({ ...groupForm, visible_roles: v })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/40">
              <div>
                <div className="text-sm font-medium">활성 상태</div>
                <div className="text-[11px] text-muted-foreground">끄면 사이드바에서 숨겨집니다</div>
              </div>
              <Switch
                checked={groupForm.active}
                onCheckedChange={(v) => setGroupForm({ ...groupForm, active: v })}
              />
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
          <DialogHeader>
            <DialogTitle>{itemForm.id ? "메뉴 수정" : "새 메뉴"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">소속 그룹</Label>
              <Select
                value={itemForm.group_id ?? "__none__"}
                onValueChange={(v) =>
                  setItemForm({ ...itemForm, group_id: v === "__none__" ? null : v })
                }
              >
                <SelectTrigger className="mt-1 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">미분류</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">라벨</Label>
                <Input
                  value={itemForm.label}
                  onChange={(e) => setItemForm({ ...itemForm, label: e.target.value })}
                  placeholder="예) 실적 입력"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">경로(URL)</Label>
                <Input
                  value={itemForm.path}
                  onChange={(e) => setItemForm({ ...itemForm, path: e.target.value })}
                  placeholder="/input"
                  className="mt-1 font-mono"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">아이콘</Label>
              <div className="mt-1">
                <IconPicker
                  value={itemForm.icon}
                  onChange={(v) => setItemForm({ ...itemForm, icon: v })}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">노출 권한</Label>
              <div className="mt-2">
                <RolesPicker
                  value={itemForm.visible_roles}
                  onChange={(v) => setItemForm({ ...itemForm, visible_roles: v })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/40">
              <div>
                <div className="text-sm font-medium">관리자 전용 표시</div>
                <div className="text-[11px] text-muted-foreground">'admin' 배지가 함께 표시됩니다</div>
              </div>
              <Switch
                checked={itemForm.is_admin_only}
                onCheckedChange={(v) => setItemForm({ ...itemForm, is_admin_only: v })}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/40">
              <div>
                <div className="text-sm font-medium">활성 상태</div>
                <div className="text-[11px] text-muted-foreground">끄면 사이드바에서 숨겨집니다</div>
              </div>
              <Switch
                checked={itemForm.active}
                onCheckedChange={(v) => setItemForm({ ...itemForm, active: v })}
              />
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
