import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink, Settings, Plus, Trash2, GripVertical, Radio, Search, Globe, Store, Facebook } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface QuickLink {
  id: string;
  label: string;
  url: string;
  icon: string;
  sort_order: number;
  active: boolean;
}

const ICON_MAP: Record<string, typeof ExternalLink> = {
  Radio, Search, Globe, Store, Facebook, ExternalLink,
};

export const QuickLinksBar = () => {
  const { isAdmin } = useRole();
  const { user } = useAuth();
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editLinks, setEditLinks] = useState<QuickLink[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const fetchLinks = async () => {
    const { data } = await supabase.from("quick_links").select("*").eq("active", true).order("sort_order");
    setLinks((data as QuickLink[]) ?? []);
  };

  useEffect(() => { fetchLinks(); }, []);

  const openEditor = () => {
    setEditLinks([...links]);
    setEditOpen(true);
  };

  const addLink = async () => {
    if (!newLabel.trim() || !newUrl.trim() || !user) return;
    const { error } = await supabase.from("quick_links").insert({
      label: newLabel.trim(),
      url: newUrl.trim(),
      icon: "ExternalLink",
      sort_order: links.length + 1,
      created_by: user.id,
    });
    if (error) { toast.error(error.message); return; }
    setNewLabel("");
    setNewUrl("");
    toast.success("링크 추가됨");
    fetchLinks();
  };

  const removeLink = async (id: string) => {
    await supabase.from("quick_links").delete().eq("id", id);
    toast.success("삭제됨");
    fetchLinks();
  };

  const updateLink = async (id: string, field: string, value: string) => {
    await supabase.from("quick_links").update({ [field]: value } as any).eq("id", id);
  };

  if (links.length === 0 && !isAdmin) return null;

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <ExternalLink className="size-3.5" /> 바로가기
        </h4>
        {isAdmin && (
          <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={openEditor}>
            <Settings className="size-3" /> 편집
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => {
          const Icon = ICON_MAP[link.icon] ?? ExternalLink;
          return (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/50 hover:bg-muted border border-border/40 text-xs font-medium transition-colors"
            >
              <Icon className="size-3.5" />
              {link.label}
            </a>
          );
        })}
      </div>

      {/* Admin editor */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>바로가기 링크 관리</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {links.map((link) => (
              <div key={link.id} className="flex items-center gap-2">
                <GripVertical className="size-4 text-muted-foreground shrink-0" />
                <Input
                  defaultValue={link.label}
                  className="h-8 text-xs flex-1"
                  onBlur={(e) => updateLink(link.id, "label", e.target.value)}
                />
                <Input
                  defaultValue={link.url}
                  className="h-8 text-xs flex-1"
                  onBlur={(e) => updateLink(link.id, "url", e.target.value)}
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeLink(link.id)}>
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-2 border-t border-border/40">
              <Plus className="size-4 text-muted-foreground shrink-0" />
              <Input placeholder="이름" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="h-8 text-xs flex-1" />
              <Input placeholder="URL" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className="h-8 text-xs flex-1" />
              <Button size="sm" className="h-8" onClick={addLink} disabled={!newLabel.trim() || !newUrl.trim()}>추가</Button>
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <Button onClick={() => { setEditOpen(false); fetchLinks(); }}>닫기</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};