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
import { Plus, Pencil, Trash2, Smartphone, Search, Hash, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDeviceModels, type DeviceModel } from "@/hooks/useDeviceModels";
import { toast } from "sonner";

const empty = {
  manufacturer: "삼성",
  model_name: "",
  official_name: "",
  aliases_raw: "",
  retail_price: 0,
  active: true,
  sort_order: 0,
};

export const DeviceModelsManager = () => {
  const { user } = useAuth();
  const { models, loading } = useDeviceModels(false);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DeviceModel | null>(null);
  const [form, setForm] = useState(empty);

  const filtered = models.filter((m) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      m.model_name.toLowerCase().includes(q) ||
      m.manufacturer.toLowerCase().includes(q) ||
      (m.official_name?.toLowerCase().includes(q) ?? false) ||
      (m.aliases ?? []).some((a) => a.toLowerCase().includes(q))
    );
  });

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (m: DeviceModel) => {
    setEditing(m);
    setForm({
      manufacturer: m.manufacturer,
      model_name: m.model_name,
      official_name: m.official_name ?? "",
      aliases_raw: (m.aliases ?? []).join(", "),
      retail_price: Number(m.retail_price) || 0,
      active: m.active,
      sort_order: m.sort_order,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.model_name.trim()) return toast.error("펫네임(모델명)을 입력하세요");
    const aliases = form.aliases_raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      manufacturer: form.manufacturer.trim(),
      model_name: form.model_name.trim(),
      official_name: form.official_name.trim() || null,
      aliases,
      retail_price: Number(form.retail_price) || 0,
      active: form.active,
      sort_order: Number(form.sort_order) || 0,
      created_by: user?.id,
    } as any;
    if (editing) {
      const { error } = await supabase.from("device_models").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("수정되었습니다");
    } else {
      const { error } = await supabase.from("device_models").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("등록되었습니다");
    }
    setOpen(false);
  };

  const remove = async (m: DeviceModel) => {
    if (!confirm(`${m.model_name} 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from("device_models").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("삭제되었습니다");
  };

  const toggleActive = async (m: DeviceModel) => {
    const { error } = await supabase
      .from("device_models")
      .update({ active: !m.active })
      .eq("id", m.id);
    if (error) return toast.error(error.message);
  };

  return (
    <Card className="p-6 glass">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Smartphone className="size-4 text-primary-glow" /> 휴대폰 모델 마스터
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            펫네임(예: S26) ↔ 공식명(예: SM-S942N) ↔ 유사어(예: 942, S26울트라) 1:N 매핑.
            직원이 어떤 형태로 입력해도 자동으로 펫네임으로 통합됩니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="펫네임/공식명/유사어 검색…"
              className="h-9 pl-8 w-56 bg-input/60"
            />
          </div>
          <Button onClick={openCreate}>
            <Plus className="size-4 mr-1.5" /> 모델 추가
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">제조사</th>
              <th className="text-left px-3 py-2">펫네임</th>
              <th className="text-left px-3 py-2">공식 모델명</th>
              <th className="text-left px-3 py-2">유사어</th>
              <th className="text-right px-3 py-2">출고가</th>
              <th className="text-center px-3 py-2">활성</th>
              <th className="text-right px-3 py-2">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">불러오는 중…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">등록된 모델이 없습니다</td></tr>
            ) : (
              filtered.map((m) => (
                <tr key={m.id} className="border-t border-border/30 hover:bg-muted/20">
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="text-xs">{m.manufacturer || "-"}</Badge>
                  </td>
                  <td className="px-3 py-2.5 font-semibold">{m.model_name}</td>
                  <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">
                    {m.official_name ?? <span className="text-border">-</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1 max-w-md">
                      {(m.aliases ?? []).length === 0 ? (
                        <span className="text-xs text-border">-</span>
                      ) : (
                        m.aliases.map((a) => (
                          <Badge key={a} variant="outline" className="text-[10px] py-0 border-primary/30 text-primary-glow">
                            {a}
                          </Badge>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {Number(m.retail_price).toLocaleString("ko-KR")}원
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Switch checked={m.active} onCheckedChange={() => toggleActive(m)} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(m)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "모델 수정" : "모델 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">제조사</Label>
                <Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Tag className="size-3 text-primary-glow" /> 펫네임 *
                </Label>
                <Input
                  value={form.model_name}
                  onChange={(e) => setForm({ ...form, model_name: e.target.value })}
                  placeholder="S26"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Hash className="size-3 text-primary-glow" /> 공식 모델명
              </Label>
              <Input
                value={form.official_name}
                onChange={(e) => setForm({ ...form, official_name: e.target.value })}
                placeholder="SM-S942N"
                className="font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                통신사 전산이나 박스에 적힌 공식 명칭
              </p>
            </div>
            <div>
              <Label className="text-xs">유사 키워드 (콤마 구분)</Label>
              <Input
                value={form.aliases_raw}
                onChange={(e) => setForm({ ...form, aliases_raw: e.target.value })}
                placeholder="S942, 942, S26울트라, GalaxyS26"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                직원들이 자주 쓰는 약칭·오기 — 자동 매핑에 사용됩니다
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">출고가 (원)</Label>
                <Input
                  type="number"
                  value={form.retail_price}
                  onChange={(e) => setForm({ ...form, retail_price: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">정렬 순서</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label className="text-xs">활성</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={save}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
