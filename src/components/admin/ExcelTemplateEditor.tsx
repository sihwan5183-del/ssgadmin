import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, ArrowUp, ArrowDown, Save, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TemplateHeader {
  key: string;
  example: string | number;
}

export interface ExcelTemplate {
  headers: TemplateHeader[];
  guide: string;
  sheet_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  settingKey: string;
  title?: string;
  onSaved?: (tpl: ExcelTemplate) => void;
}

const DEFAULT_TPL: ExcelTemplate = {
  headers: [{ key: "고객명", example: "" }],
  guide: "이 행은 안내용입니다 (삭제하지 마세요). 데이터는 3행부터 입력하세요.",
  sheet_name: "Sheet1",
};

export const ExcelTemplateEditor = ({ open, onOpenChange, settingKey, title, onSaved }: Props) => {
  const [tpl, setTpl] = useState<ExcelTemplate>(DEFAULT_TPL);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", settingKey)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setTpl(data.value as unknown as ExcelTemplate);
        setLoading(false);
      });
  }, [open, settingKey]);

  const update = (i: number, patch: Partial<TemplateHeader>) =>
    setTpl((t) => ({ ...t, headers: t.headers.map((h, idx) => (idx === i ? { ...h, ...patch } : h)) }));

  const addRow = () =>
    setTpl((t) => ({ ...t, headers: [...t.headers, { key: "새 컬럼", example: "" }] }));

  const removeRow = (i: number) =>
    setTpl((t) => ({ ...t, headers: t.headers.filter((_, idx) => idx !== i) }));

  const move = (i: number, dir: -1 | 1) => {
    setTpl((t) => {
      const arr = [...t.headers];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return t;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...t, headers: arr };
    });
  };

  const save = async () => {
    if (tpl.headers.some((h) => !h.key.trim())) {
      toast.error("빈 헤더명이 있습니다");
      return;
    }
    const keys = tpl.headers.map((h) => h.key);
    if (new Set(keys).size !== keys.length) {
      toast.error("중복된 헤더명이 있습니다");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key: settingKey, value: tpl as any, description: "엑셀 양식 샘플 템플릿" },
        { onConflict: "key" },
      );
    setSaving(false);
    if (error) {
      toast.error("저장 실패", { description: error.message });
      return;
    }
    toast.success("양식이 저장되었습니다");
    onSaved?.(tpl);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title ?? "엑셀 양식 편집"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <Label className="text-xs">시트 이름</Label>
            <Input
              value={tpl.sheet_name}
              onChange={(e) => setTpl({ ...tpl, sheet_name: e.target.value })}
              className="h-9"
            />
          </div>
          <div className="md:col-span-1">
            <Label className="text-xs">1행 안내 문구</Label>
            <Input
              value={tpl.guide}
              onChange={(e) => setTpl({ ...tpl, guide: e.target.value })}
              className="h-9"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-muted-foreground">
            헤더 {tpl.headers.length}개 · 순서/이름/예시값 자유 편집
          </div>
          <Button size="sm" variant="outline" onClick={addRow}>
            <Plus className="size-3.5 mr-1" /> 컬럼 추가
          </Button>
        </div>

        <ScrollArea className="flex-1 rounded-lg border border-border/40">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground sticky top-0">
              <tr>
                <th className="text-left px-2 py-2 w-12">#</th>
                <th className="text-left px-2 py-2">헤더명 (엑셀 컬럼)</th>
                <th className="text-left px-2 py-2">예시값 (3행)</th>
                <th className="text-left px-2 py-2 w-32">정렬/삭제</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-muted-foreground">
                    불러오는 중…
                  </td>
                </tr>
              ) : (
                tpl.headers.map((h, i) => (
                  <tr key={i} className="border-t border-border/30">
                    <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-2 py-1.5">
                      <Textarea
                        value={h.key}
                        onChange={(e) => update(i, { key: e.target.value })}
                        rows={1}
                        className="min-h-9 resize-none"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={String(h.example ?? "")}
                        onChange={(e) => update(i, { example: e.target.value })}
                        className="h-9"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => move(i, -1)} className="size-7">
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => move(i, 1)} className="size-7">
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeRow(i)}
                          className="size-7 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollArea>

        <div className="text-[11px] text-muted-foreground mt-2">
          ⚠️ 업로드 파서는 기존 헤더명을 인식합니다. 기본 헤더명을 변경하면 업로드가 안 될 수 있어요.
          새 컬럼은 다운로드 양식에만 추가되며, 업로드 시 sales.custom_fields로 저장하려면 별도 매핑 업로드를 사용하세요.
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={save} disabled={saving}>
            <Save className="size-4 mr-1.5" /> {saving ? "저장 중…" : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
