import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FieldDefinition } from "@/hooks/useFieldDefinitions";

interface Props {
  fields: FieldDefinition[];
  values: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
}

/**
 * 관리자가 정의한 동적 필드를 폼에 자동 렌더링.
 * values는 sales.custom_fields(JSONB) 등에 그대로 저장된다.
 */
export const DynamicFieldRenderer = ({ fields, values, onChange }: Props) => {
  if (!fields.length) return null;
  const set = (k: string, v: any) => onChange({ ...values, [k]: v });

  return (
    <>
      {fields
        .filter((f) => f.visible_in_form)
        .map((f) => {
          const v = values[f.field_key] ?? f.default_value ?? "";
          const id = `dyn-${f.field_key}`;
          return (
            <div key={f.id} className="space-y-1.5">
              <Label htmlFor={id} className="text-xs text-muted-foreground">
                {f.label}
                {f.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              {f.field_type === "textarea" ? (
                <Textarea id={id} value={v} onChange={(e) => set(f.field_key, e.target.value)} />
              ) : f.field_type === "boolean" ? (
                <Switch checked={!!v} onCheckedChange={(b) => set(f.field_key, b)} />
              ) : f.field_type === "select" ? (
                <Select value={String(v ?? "")} onValueChange={(val) => set(f.field_key, val)}>
                  <SelectTrigger id={id}>
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {f.options.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={id}
                  type={f.field_type === "number" ? "number" : f.field_type === "date" ? "date" : "text"}
                  value={v}
                  onChange={(e) =>
                    set(
                      f.field_key,
                      f.field_type === "number" ? Number(e.target.value) : e.target.value,
                    )
                  }
                />
              )}
            </div>
          );
        })}
    </>
  );
};
