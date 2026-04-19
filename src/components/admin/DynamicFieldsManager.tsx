import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, GripVertical } from "lucide-react";

const TABLES = [
  { key: "sales", label: "실적 (sales)" },
  { key: "device_inventory", label: "단말기 재고" },
  { key: "ad_spend", label: "지출 (ad_spend)" },
] as const;

const TYPES = ["text", "number", "date", "select", "boolean", "textarea"] as const;
type FieldType = (typeof TYPES)[number];

interface Def {
  id: string;
  table_name: string;
  field_key: string;
  label: string;
  field_type: FieldType;
  options: string[];
  required: boolean;
  visible_in_list: boolean;
  visible_in_form: boolean;
  section: string | null;
  sort_order: number;
  default_value: string | null;
  active: boolean;
}

const empty = (table: string): Omit<Def, "id"> => ({
  table_name: table,
  field_key: "",
  label: "",
  field_type: "text",
  options: [],
  required: false,
  visible_in_list: true,
  visible_in_form: true,
  section: null,
  sort_order: 0,
  default_value: null,
  active: true,
});

export const DynamicFieldsManager = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<string>("sales");
  const [rows, setRows] = useState<Def[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Def | null>(null);
  const [form, setForm] = useState<Omit<Def, "id">>(empty("sales"));
  const [optionsText, setOptionsText] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("field_definitions")
      .select("*")
      .eq("table_name", tab)
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    else
      setRows(
        (data ?? []).map((d: any) => ({
          ...d,
          options: Array.isArray(d.options) ? d.options : [],
        })),
      );
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...empty(tab), sort_order: rows.length + 1 });
    setOptionsText("");
    setDialogOpen(true);
  };

  const openEdit = (d: Def) => {
    setEditing(d);
    setForm({ ...d });
    setOptionsText(d.options.join("\n"));
    setDialogOpen(true);
  };

  const save = async () => {
    if (!user) return;
    if (!form.field_key.trim() || !form.label.trim())
      return toast.error("필드 키와 라벨은 필수입니다");
    if (!/^[a-z_][a-z0-9_]*$/.test(form.field_key))
      return toast.error("필드 키는 영문 소문자/숫자/_ 만 사용");

    const payload = {
      ...form,
      options:
        form.field_type === "select"
          ? optionsText
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      created_by: user.id,
    };

    if (editing) {
      const { error } = await supabase
        .from("field_definitions")
        .update(payload)
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("수정되었습니다");
    } else {
      const { error } = await supabase.from("field_definitions").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("필드가 추가되었습니다");
    }
    setDialogOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("필드를 삭제하시겠습니까? (저장된 데이터는 유지됩니다)")) return;
    const { error } = await supabase.from("field_definitions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("삭제되었습니다");
    load();
  };

  const toggleActive = async (d: Def) => {
    await supabase.from("field_definitions").update({ active: !d.active }).eq("id", d.id);
    load();
  };

  return (
    <Card className="p-6 glass border-border/40">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">동적 입력 항목 관리</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            관리자가 추가한 항목은 입력 폼·리스트·엑셀 매핑에 즉시 반영됩니다
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4 mr-1.5" /> 필드 추가
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {TABLES.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABLES.map((t) => (
          <TabsContent key={t.key} value={t.key} className="mt-4">
            {loading ? (
              <div className="py-8 text-center text-muted-foreground text-sm">불러오는 중…</div>
            ) : rows.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                추가된 동적 필드가 없습니다
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map((d) => (
                  <div
                    key={d.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      d.active ? "border-border/40 bg-card/40" : "border-dashed opacity-50"
                    }`}
                  >
                    <GripVertical className="size-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{d.label}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {d.field_key}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {d.field_type}
                        </Badge>
                        {d.required && <Badge className="text-[10px]">필수</Badge>}
                      </div>
                      {d.section && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          섹션: {d.section}
                        </div>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(d)}>
                      {d.active ? "숨기기" : "사용"}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(d)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(d.id)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "필드 수정" : "필드 추가"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="라벨 (화면 표시명) *">
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </Field>
            <Field label="필드 키 (영문/소문자/_) *">
              <Input
                value={form.field_key}
                onChange={(e) => setForm({ ...form, field_key: e.target.value.toLowerCase() })}
                placeholder="예: customer_grade"
                disabled={!!editing}
              />
            </Field>
            <Field label="유형">
              <Select
                value={form.field_type}
                onValueChange={(v) => setForm({ ...form, field_type: v as FieldType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="섹션 (선택)">
              <Input
                value={form.section ?? ""}
                onChange={(e) => setForm({ ...form, section: e.target.value || null })}
                placeholder="기본정보, 결제 등"
              />
            </Field>
            {form.field_type === "select" && (
              <Field label="선택지 (한 줄에 하나)" full>
                <textarea
                  className="w-full min-h-24 rounded-md bg-input/60 border border-border/40 px-3 py-2 text-sm"
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                />
              </Field>
            )}
            <Field label="기본값">
              <Input
                value={form.default_value ?? ""}
                onChange={(e) => setForm({ ...form, default_value: e.target.value || null })}
              />
            </Field>
            <Field label="정렬 순서">
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
              />
            </Field>
            <div className="col-span-2 flex flex-wrap gap-4 pt-2">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.required}
                  onCheckedChange={(b) => setForm({ ...form, required: b })}
                />
                필수
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.visible_in_form}
                  onCheckedChange={(b) => setForm({ ...form, visible_in_form: b })}
                />
                폼에 표시
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.visible_in_list}
                  onCheckedChange={(b) => setForm({ ...form, visible_in_list: b })}
                />
                리스트에 표시
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={save}>{editing ? "수정" : "추가"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

const Field = ({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) => (
  <div className={`space-y-1 ${full ? "col-span-2" : ""}`}>
    <Label className="text-xs text-muted-foreground">{label}</Label>
    {children}
  </div>
);
