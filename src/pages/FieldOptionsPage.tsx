import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "channel", label: "인입경로", hint: "당근, 모요, 오프라인 등" },
  { key: "product", label: "가입상품", hint: "모바일, 인터넷, USIM MNP 등" },
  { key: "sale_type", label: "판매유형", hint: "MNP, 신규, 기변 등" },
  { key: "open_method", label: "개통방식", hint: "선개통 / 후개통" },
  { key: "status", label: "최종상태", hint: "개통완료, 보류, 취소" },
  { key: "rate_plan", label: "요금제", hint: "프리미어 / 5G / LTE 등" },
  { key: "delivery_type", label: "발송유형", hint: "택배, 퀵, 매장방문" },
  { key: "bank", label: "은행", hint: "국민, 신한, 카카오뱅크 등" },
  { key: "media", label: "광고 매체", hint: "네이버, 메타, 유튜브 등" },
  { key: "expense_type", label: "지출 항목", hint: "임대료, 통신비, 운영비 등" },
];

interface Row {
  id: string;
  field: string;
  value: string;
  sort_order: number;
  active: boolean;
}

export default function FieldOptionsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [activeField, setActiveField] = useState<string>("channel");
  const [newValue, setNewValue] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("field_options")
      .select("*")
      .eq("field", activeField)
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    else setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeField]);

  const add = async () => {
    if (!newValue.trim() || !user) return;
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.sort_order), 0);
    const { error } = await supabase.from("field_options").insert({
      field: activeField,
      value: newValue.trim(),
      sort_order: maxOrder + 1,
      created_by: user.id,
    });
    if (error) toast.error("저장 실패: " + error.message);
    else {
      toast.success("옵션이 추가되었습니다");
      setNewValue("");
      load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("이 옵션을 삭제할까요?")) return;
    const { error } = await supabase.from("field_options").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("삭제되었습니다");
      load();
    }
  };

  const toggle = async (r: Row) => {
    const { error } = await supabase
      .from("field_options")
      .update({ active: !r.active })
      .eq("id", r.id);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <div>
      <Header
        title="입력 항목 관리"
        subtitle="실적 입력 화면의 드롭다운 옵션을 직접 추가·수정·삭제할 수 있습니다"
        showScopeToggle={false}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* 왼쪽: 필드 리스트 */}
        <Card className="p-4 glass h-fit">
          <div className="flex items-center gap-2 mb-3">
            <Settings2 className="size-4 text-primary" />
            <span className="text-sm font-semibold">관리할 항목</span>
          </div>
          <div className="space-y-1">
            {FIELDS.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveField(f.key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeField === f.key
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-muted/60 text-foreground"
                }`}
              >
                <div>{f.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{f.hint}</div>
              </button>
            ))}
          </div>
        </Card>

        {/* 오른쪽: 옵션 편집 */}
        <Card className="p-6 glass">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">
                {FIELDS.find((f) => f.key === activeField)?.label} 옵션
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                현재 등록된 항목: {rows.length}개
              </p>
            </div>
          </div>

          <div className="flex gap-2 mb-5">
            <Input
              placeholder="새 옵션 이름 입력 (예: 카카오톡 채널)"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <Button onClick={add} className="gap-2 shrink-0">
              <Plus className="size-4" />
              추가
            </Button>
          </div>

          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">불러오는 중...</div>
            ) : rows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                등록된 옵션이 없습니다
              </div>
            ) : (
              rows.map((r, i) => (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    r.active ? "border-border bg-card" : "border-dashed border-border/50 bg-muted/30 opacity-60"
                  }`}
                >
                  <span className="text-xs text-muted-foreground w-6 text-right">{i + 1}</span>
                  <span className="flex-1 font-medium text-sm">{r.value}</span>
                  {!r.active && <Badge variant="outline" className="text-[10px]">비활성</Badge>}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggle(r)}
                    className="text-xs"
                  >
                    {r.active ? "숨기기" : "사용"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(r.id)}
                    className="size-8"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
