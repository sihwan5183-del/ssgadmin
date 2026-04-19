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
import { Plus, Pencil, Trash2, Smartphone, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDeviceModels, type DeviceModel } from "@/hooks/useDeviceModels";
import { toast } from "sonner";

const empty = {
  manufacturer: "삼성",
  model_name: "",
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
      m.manufacturer.toLowerCase().includes(q)
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
      retail_price: Number(m.retail_price) || 0,
      active: m.active,
      sort_order: m.sort_order,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.model_name.trim()) return toast.error("모델명을 입력하세요");
    const payload = {
      manufacturer: form.manufacturer.trim(),
      model_name: form.model_name.trim(),
      retail_price: Number(form.retail_price) || 0,
      active: form.active,
      sort_order: Number(form.sort_order) || 0,
      created_by: user?.id,
    };
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
            실적·재고에서 사용하는 휴대폰 모델 목록을 관리합니다. 비활성화 시 신규 입력에서 숨겨집니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="검색…"
              className="h-9 pl-8 w-48 bg-input/60"
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
              <th className="text-left px-3 py-2">모델명</th>
              <th className="text-right px-3 py-2">출고가</th>
              <th className="text-center px-3 py-2">활성</th>
              <th className="text-right px-3 py-2">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">불러오는 중…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">등록된 모델이 없습니다</td></tr>
            ) : (
              filtered.map((m) => (
                <tr key={m.id} className="border-t border-border/30 hover:bg-muted/20">
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="text-xs">{m.manufacturer || "-"}</Badge>
                  </td>
                  <td className="px-3 py-2.5 font-medium">{m.model_name}</td>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "모델 수정" : "모델 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">제조사</Label>
              <Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">모델명 *</Label>
              <Input value={form.model_name} onChange={(e) => setForm({ ...form, model_name: e.target.value })} />
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
