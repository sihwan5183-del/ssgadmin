import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { inflowChannels, planTiers, strategyProducts, addonServices } from "@/data/mockData";
import { Zap, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const InputPage = () => {
  const [selectedStrategy, setSelectedStrategy] = useState<string[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  const toggle = (arr: string[], setArr: (v: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("실적이 저장되었습니다", { description: "대시보드에 즉시 반영됩니다" });
  };

  return (
    <>
      <Header title="실적 입력" subtitle="현장에서 10초 안에 입력하세요" />

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-5 pb-10">
        <div className="glass rounded-2xl p-5 md:p-6 space-y-4 shadow-card-elevated">
          <div className="flex items-center gap-2 text-xs">
            <Badge className="bg-gradient-primary text-primary-foreground border-0">
              <Zap className="size-3 mr-1" /> 빠른 입력
            </Badge>
            <span className="text-muted-foreground">필수 항목만 채우면 즉시 저장됩니다</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="고객명">
              <Input placeholder="홍길동" required className="h-11 bg-input/60" />
            </Field>
            <Field label="연락처">
              <Input placeholder="010-0000-0000" inputMode="tel" required className="h-11 bg-input/60" />
            </Field>
          </div>

          <Field label="인입 경로">
            <Select required>
              <SelectTrigger className="h-11 bg-input/60"><SelectValue placeholder="경로를 선택하세요" /></SelectTrigger>
              <SelectContent>
                {inflowChannels.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="모델명">
              <Input placeholder="갤럭시 S25" className="h-11 bg-input/60" />
            </Field>
            <Field label="요금제">
              <Select>
                <SelectTrigger className="h-11 bg-input/60"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {planTiers.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="부가서비스">
            <ChipGroup options={[...addonServices]} selected={selectedAddons} onToggle={(v) => toggle(selectedAddons, setSelectedAddons, v)} />
          </Field>

          <Field label="전략상품">
            <ChipGroup
              options={[...strategyProducts]}
              selected={selectedStrategy}
              onToggle={(v) => toggle(selectedStrategy, setSelectedStrategy, v)}
              accent
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="리베이트 (원)">
              <Input type="number" inputMode="numeric" placeholder="0" className="h-11 bg-input/60 tabular-nums" />
            </Field>
            <Field label="오퍼 / 지원금 (원)">
              <Input type="number" inputMode="numeric" placeholder="0" className="h-11 bg-input/60 tabular-nums" />
            </Field>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-14 text-base font-semibold bg-gradient-primary hover:opacity-95 shadow-glow rounded-2xl"
        >
          <Check className="size-5 mr-2" /> 실적 저장
        </Button>
      </form>
    </>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground font-medium">{label}</Label>
    {children}
  </div>
);

const ChipGroup = ({
  options, selected, onToggle, accent,
}: { options: string[]; selected: string[]; onToggle: (v: string) => void; accent?: boolean }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((o) => {
      const on = selected.includes(o);
      return (
        <button
          type="button"
          key={o}
          onClick={() => onToggle(o)}
          className={cn(
            "px-3 py-2 rounded-xl text-sm font-medium border transition-all",
            on
              ? accent
                ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                : "bg-primary/15 text-primary-glow border-primary/40"
              : "bg-card/40 text-muted-foreground border-border/60 hover:text-foreground hover:border-primary/30"
          )}
        >
          {o}
        </button>
      );
    })}
  </div>
);

export default InputPage;
