import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Link2 } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import { resolveIcon } from "@/lib/menuIcons";

interface QuickLink {
  id: string;
  label: string;
  url: string;
  icon: string;
  sort_order: number;
  active: boolean;
}

const LinkIcon = ({ name }: { name?: string }) => {
  const Icon = resolveIcon(name || "ExternalLink");
  return <Icon className="size-6 text-slate-700" />;
};

export const QuickLinksWidget = () => {
  const { isAdmin } = useRole();
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [editing, setEditing] = useState(false);
  const [editItem, setEditItem] = useState<Partial<QuickLink> | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("quick_links")
      .select("*")
      .eq("active", true)
      .order("sort_order");
    setLinks((data as QuickLink[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const saveItem = async () => {
    if (!editItem?.label || !editItem?.url) {
      toast.error("이름과 URL을 입력해주세요");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editItem.id) {
      const { error } = await supabase.from("quick_links").update({
        label: editItem.label,
        url: editItem.url,
        icon: editItem.icon || "ExternalLink",
      }).eq("id", editItem.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("quick_links").insert({
        label: editItem.label,
        url: editItem.url,
        icon: editItem.icon || "ExternalLink",
        sort_order: links.length,
        created_by: user.id,
      });
      if (error) { toast.error(error.message); return; }
    }
    toast.success("저장 완료");
    setEditItem(null);
    load();
  };

  const deleteItem = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("quick_links").delete().eq("id", id);
    toast.success("삭제 완료");
    load();
  };

  if (links.length === 0 && !isAdmin) return null;

  return (
    <Card className="h-full w-full flex flex-col bg-card border-border/60 shadow-sm rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link2 className="size-4 text-foreground" />
          <h4 className="text-sm font-bold text-slate-900">업무 바로가기</h4>
          <Badge variant="outline" className="text-[10px]">{links.length}개</Badge>
        </div>
        {isAdmin && (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
              onClick={() => setEditing(!editing)}
            >
              <Pencil className="size-3" /> {editing ? "완료" : "관리"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => setEditItem({ label: "", url: "", icon: "ExternalLink" })}
            >
              <Plus className="size-3" /> 추가
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 flex-1 min-h-0 overflow-y-auto content-start">
        {links.map((link) => (
          <div key={link.id} className="relative group">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border border-border/60 bg-card hover:bg-slate-50 hover:border-foreground/30 hover:-translate-y-1 transition-all duration-200 ease-in-out text-center"
            >
              <div className="size-12 rounded-xl bg-slate-100 grid place-items-center shrink-0">
                <LinkIcon name={link.icon} />
              </div>
              <span className="text-xs md:text-sm font-semibold text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                {link.label}
              </span>
            </a>
            {editing && isAdmin && (
              <div className="absolute -top-1.5 -right-1.5 flex gap-0.5 z-10">
                <button
                  onClick={() => setEditItem(link)}
                  className="size-5 rounded-full bg-primary text-primary-foreground grid place-items-center text-[9px] shadow-sm"
                >
                  <Pencil className="size-2.5" />
                </button>
                <button
                  onClick={() => deleteItem(link.id)}
                  className="size-5 rounded-full bg-destructive text-destructive-foreground grid place-items-center text-[9px] shadow-sm"
                >
                  <Trash2 className="size-2.5" />
                </button>
              </div>
            )}
          </div>
        ))}
        {links.length === 0 && (
          <div className="col-span-full text-center text-xs text-muted-foreground py-4">
            바로가기가 없습니다. 관리자가 추가해주세요.
          </div>
        )}
      </div>

      {/* Edit/Add Dialog */}
      <Dialog open={!!editItem} onOpenChange={(v) => !v && setEditItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editItem?.id ? "바로가기 수정" : "바로가기 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">이름</label>
              <Input
                value={editItem?.label ?? ""}
                onChange={(e) => setEditItem((p) => ({ ...p, label: e.target.value }))}
                placeholder="예: LG U+ 전산"
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">URL</label>
              <Input
                value={editItem?.url ?? ""}
                onChange={(e) => setEditItem((p) => ({ ...p, url: e.target.value }))}
                placeholder="https://..."
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditItem(null)}>취소</Button>
            <Button onClick={saveItem}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
