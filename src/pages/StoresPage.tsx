import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Store as StoreIcon, Plus, Pencil, Trash2, ShieldAlert } from "lucide-react";
import { useStores, type Store } from "@/hooks/useStores";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const empty = {
  name: "",
  code: "",
  region: "",
  manager: "",
  phone: "",
  active: true,
};

export default function StoresPage() {
  const { stores, refresh } = useStores();
  const { isAdmin } = useRole();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [form, setForm] = useState(empty);

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (s: Store) => {
    setEditing(s);
    setForm({
      name: s.name,
      code: s.code ?? "",
      region: s.region ?? "",
      manager: s.manager ?? "",
      phone: s.phone ?? "",
      active: s.active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("매장명을 입력하세요");
    const payload = { ...form };
    if (editing) {
      const { error } = await supabase.from("stores").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("수정되었습니다");
    } else {
      const { error } = await supabase.from("stores").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("매장이 등록되었습니다");
    }
    setOpen(false);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("매장을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("stores").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("삭제되었습니다");
    refresh();
  };

  return (
    <>
      <Header title="매장 관리" subtitle="재고 위치/이동 워크플로우의 기준이 되는 매장 마스터" />

      {!isAdmin && (
        <Card className="p-4 mb-4 glass border-amber-500/30 flex items-center gap-2 text-sm">
          <ShieldAlert className="size-4 text-amber-400" />
          매장 마스터 추가/수정은 관리자만 가능합니다. 조회는 모든 사용자에게 허용됩니다.
        </Card>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">총 {stores.length}개 매장</div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="size-4 mr-1.5" /> 매장 추가
          </Button>
        )}
      </div>

      <Card className="glass border-border/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2.5">매장명</th>
                <th className="text-left px-3 py-2.5">코드</th>
                <th className="text-left px-3 py-2.5">지역</th>
                <th className="text-left px-3 py-2.5">담당자</th>
                <th className="text-left px-3 py-2.5">연락처</th>
                <th className="text-left px-3 py-2.5">상태</th>
                <th className="text-right px-3 py-2.5">관리</th>
              </tr>
            </thead>
            <tbody>
              {stores.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-foreground">
                    등록된 매장이 없습니다
                  </td>
                </tr>
              ) : (
                stores.map((s) => (
                  <tr key={s.id} className="border-t border-border/30 hover:bg-muted/20">
                    <td className="px-3 py-2.5 font-medium flex items-center gap-2">
                      <StoreIcon className="size-3.5 text-primary-glow" /> {s.name}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{s.code ?? "-"}</td>
                    <td className="px-3 py-2.5">{s.region ?? "-"}</td>
                    <td className="px-3 py-2.5">{s.manager ?? "-"}</td>
                    <td className="px-3 py-2.5 tabular-nums">{s.phone ?? "-"}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={s.active ? "default" : "outline"}>
                        {s.active ? "활성" : "비활성"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {isAdmin && (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(s)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(s.id)}>
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "매장 수정" : "매장 추가"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <F label="매장명 *">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </F>
            <F label="매장 코드">
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </F>
            <F label="지역">
              <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
            </F>
            <F label="담당자">
              <Input value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} />
            </F>
            <F label="연락처">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </F>
            <F label="활성 여부">
              <div className="h-10 flex items-center">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              </div>
            </F>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button onClick={save}>{editing ? "수정" : "등록"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
