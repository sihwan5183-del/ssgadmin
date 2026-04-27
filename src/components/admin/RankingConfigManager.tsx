import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crown, Search, Save, UserX, UserCheck } from "lucide-react";

export type RankingConfig = {
  default_period: "today" | "week" | "month" | "quarter";
  excluded_user_ids: string[];
  hide_excluded: boolean;
};

export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  default_period: "month",
  excluded_user_ids: [],
  hide_excluded: true,
};

export function RankingConfigManager() {
  const [config, setConfig] = useState<RankingConfig>(DEFAULT_RANKING_CONFIG);
  const [profiles, setProfiles] = useState<{ user_id: string; display_name: string; store: string | null }[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: setting }, { data: profs }] = await Promise.all([
        supabase.from("app_settings").select("value").eq("key", "ranking.config").maybeSingle(),
        supabase.from("profiles").select("user_id, display_name, store").eq("status", "active").order("display_name"),
      ]);
      if (setting?.value) setConfig({ ...DEFAULT_RANKING_CONFIG, ...(setting.value as any) });
      setProfiles(profs ?? []);
      setLoading(false);
    })();
  }, []);

  const excluded = useMemo(() => new Set(config.excluded_user_ids), [config.excluded_user_ids]);

  const filtered = useMemo(
    () =>
      profiles.filter(
        (p) => !search || p.display_name.toLowerCase().includes(search.toLowerCase()) || (p.store ?? "").toLowerCase().includes(search.toLowerCase())
      ),
    [profiles, search]
  );

  const toggle = (uid: string) => {
    const next = new Set(excluded);
    if (next.has(uid)) next.delete(uid);
    else next.add(uid);
    setConfig({ ...config, excluded_user_ids: Array.from(next) });
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "ranking.config", value: config as any, description: "판매 랭킹 센터 설정" }, { onConflict: "key" });
    setSaving(false);
    if (error) toast.error("저장 실패: " + error.message);
    else toast.success("랭킹 설정이 저장되었습니다");
  };

  if (loading) return <Card className="p-6 glass">불러오는 중…</Card>;

  return (
    <div className="space-y-4">
      <Card className="p-6 glass">
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Crown className="size-4 text-amber-500" /> 판매 랭킹 센터 설정
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">기본 집계 기간</label>
            <Select
              value={config.default_period}
              onValueChange={(v) => setConfig({ ...config, default_period: v as RankingConfig["default_period"] })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">오늘</SelectItem>
                <SelectItem value="week">주간 (이번 주)</SelectItem>
                <SelectItem value="month">월간 (이번 달)</SelectItem>
                <SelectItem value="quarter">분기 (이번 분기)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">랭킹 페이지 진입 시 기본 선택되는 기간입니다.</p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">제외 직원 숨김</label>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/40">
              <div className="text-sm">
                <div className="font-medium">제외 직원을 랭킹에서 완전히 숨김</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  꺼두면 표시는 되지만 회색 처리되고 순위 부여되지 않습니다.
                </div>
              </div>
              <Switch checked={config.hide_excluded} onCheckedChange={(v) => setConfig({ ...config, hide_excluded: v })} />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 glass">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <UserX className="size-4 text-destructive" /> 랭킹 제외 직원
            <Badge variant="outline" className="text-[10px] ml-1">제외 {excluded.size}명 / 전체 {profiles.length}명</Badge>
          </h3>
          <div className="relative w-64 max-w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="이름·매장 검색" className="pl-8 h-9 text-xs" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[420px] overflow-y-auto pr-1">
          {filtered.map((p) => {
            const isExcluded = excluded.has(p.user_id);
            return (
              <button
                key={p.user_id}
                type="button"
                onClick={() => toggle(p.user_id)}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-left transition-all ${
                  isExcluded
                    ? "bg-destructive/[0.08] border-destructive/40"
                    : "bg-background/40 border-border/50 hover:border-primary/40"
                }`}
              >
                <div className="min-w-0">
                  <div className={`text-sm font-medium truncate ${isExcluded ? "line-through text-muted-foreground" : ""}`}>
                    {p.display_name}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">{p.store ?? "매장 미배정"}</div>
                </div>
                {isExcluded ? (
                  <Badge variant="outline" className="border-destructive/40 text-destructive bg-destructive/10 text-[10px] gap-0.5">
                    <UserX className="size-3" /> 제외
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[10px] gap-0.5">
                    <UserCheck className="size-3" /> 포함
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={save} disabled={saving} className="gap-2">
            <Save className="size-4" /> {saving ? "저장 중…" : "랭킹 설정 저장"}
          </Button>
        </div>
      </Card>
    </div>
  );
}