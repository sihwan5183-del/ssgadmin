import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { toast } from "sonner";
import { Plus, Trash2, Save, MessageSquare } from "lucide-react";

type Template = {
  id: string;
  channel: string;
  type: string;
  title: string;
  content: string;
  active: boolean;
};

const TYPE_OPTIONS = [
  { value: "absence", label: "부재케어" },
  { value: "recare", label: "재케어" },
];

export default function SmsTemplatePage() {
  const { isSuperAdmin } = useSuperAdmin();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<string[]>([]);
  const [newChannel, setNewChannel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Template>>({});
  const [addForm, setAddForm] = useState({ channel: "", type: "absence", title: "", content: "" });
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("sms_templates").select("*").order("channel").order("type").order("created_at");
    setTemplates(data ?? []);
    const chs = [...new Set((data ?? []).map((t: Template) => t.channel))];
    setChannels(chs);
    setLoading(false);
  }

  async function save(id: string) {
    const { error } = await supabase.from("sms_templates").update(editDraft).eq("id", id);
    if (error) return toast.error("저장 실패: " + error.message);
    toast.success("저장됐습니다");
    setEditingId(null);
    load();
  }

  async function del(id: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    const { error } = await supabase.from("sms_templates").delete().eq("id", id);
    if (error) return toast.error("삭제 실패");
    toast.success("삭제됐습니다");
    load();
  }

  async function addTemplate() {
    if (!addForm.channel || !addForm.title || !addForm.content) {
      return toast.error("채널, 제목, 내용을 모두 입력해주세요");
    }
    const { error } = await supabase.from("sms_templates").insert({ ...addForm, active: true });
    if (error) return toast.error("추가 실패: " + error.message);
    toast.success("추가됐습니다");
    setShowAdd(false);
    setAddForm({ channel: "", type: "absence", title: "", content: "" });
    load();
  }

  async function addChannel() {
    if (!newChannel.trim()) return;
    setChannels(prev => [...new Set([...prev, newChannel.trim()])]);
    setAddForm(f => ({ ...f, channel: newChannel.trim() }));
    setNewChannel("");
    toast.success(`'${newChannel.trim()}' 채널이 추가됐습니다`);
  }

  async function toggleActive(t: Template) {
    await supabase.from("sms_templates").update({ active: !t.active }).eq("id", t.id);
    load();
  }

  const grouped = templates.reduce((acc, t) => {
    if (!acc[t.channel]) acc[t.channel] = [];
    acc[t.channel].push(t);
    return acc;
  }, {} as Record<string, Template[]>);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-5 text-primary" />
            <h1 className="text-lg font-bold">문자 템플릿 관리</h1>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" /> 템플릿 추가
          </button>
        </div>

        {/* 채널 추가 */}
        <Card className="p-4">
          <div className="text-xs font-semibold text-muted-foreground mb-2">채널 관리</div>
          <div className="flex gap-2 flex-wrap mb-2">
            {channels.map(ch => (
              <span key={ch} className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">{ch}</span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newChannel}
              onChange={e => setNewChannel(e.target.value)}
              placeholder="새 채널명 (예: 네이버)"
              className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-border/60"
              onKeyDown={e => e.key === "Enter" && addChannel()}
            />
            <button onClick={addChannel} className="text-sm px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 border border-border/60">
              + 추가
            </button>
          </div>
        </Card>

        {/* 템플릿 추가 폼 */}
        {showAdd && (
          <Card className="p-4 border-2 border-primary/30">
            <div className="text-sm font-semibold mb-3">새 템플릿 추가</div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">채널</div>
                  <select
                    value={addForm.channel}
                    onChange={e => setAddForm(f => ({ ...f, channel: e.target.value }))}
                    className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-border/60"
                  >
                    <option value="">선택</option>
                    {channels.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">유형</div>
                  <select
                    value={addForm.type}
                    onChange={e => setAddForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-border/60"
                  >
                    {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">제목 (사유)</div>
                <input
                  value={addForm.title}
                  onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="예: 통화중, 부재"
                  className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-border/60"
                />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">문자 내용</div>
                <textarea
                  value={addForm.content}
                  onChange={e => setAddForm(f => ({ ...f, content: e.target.value }))}
                  rows={4}
                  placeholder="문자 내용을 입력하세요"
                  className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-border/60 resize-none"
                />
                <div className="text-right text-xs text-muted-foreground mt-0.5">{addForm.content.length}자</div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAdd(false)} className="text-sm px-3 py-1.5 text-muted-foreground">취소</button>
                <button onClick={addTemplate} className="text-sm px-4 py-1.5 rounded-lg bg-primary text-primary-foreground">추가</button>
              </div>
            </div>
          </Card>
        )}

        {/* 채널별 템플릿 목록 */}
        {loading ? (
          <div className="text-center py-10 text-muted-foreground text-sm">불러오는 중...</div>
        ) : (
          Object.entries(grouped).map(([channel, tmplts]) => (
            <Card key={channel} className="overflow-hidden">
              <div className="px-4 py-3 bg-muted/30 border-b flex items-center justify-between">
                <span className="font-semibold text-sm">{channel}</span>
                <span className="text-xs text-muted-foreground">{tmplts.length}개</span>
              </div>
              <div className="divide-y divide-border/30">
                {tmplts.map(t => (
                  <div key={t.id} className={`p-4 ${!t.active ? "opacity-50" : ""}`}>
                    {editingId === t.id ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">유형</div>
                            <select
                              value={editDraft.type ?? t.type}
                              onChange={e => setEditDraft(d => ({ ...d, type: e.target.value }))}
                              className="w-full text-xs px-2 py-1.5 rounded border border-border/60"
                            >
                              {TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">제목</div>
                            <input
                              value={editDraft.title ?? t.title}
                              onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
                              className="w-full text-xs px-2 py-1.5 rounded border border-border/60"
                            />
                          </div>
                        </div>
                        <textarea
                          value={editDraft.content ?? t.content}
                          onChange={e => setEditDraft(d => ({ ...d, content: e.target.value }))}
                          rows={4}
                          className="w-full text-xs px-2 py-1.5 rounded border border-border/60 resize-none"
                        />
                        <div className="text-right text-xs text-muted-foreground">{(editDraft.content ?? t.content).length}자</div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingId(null)} className="text-xs px-2.5 py-1 text-muted-foreground">취소</button>
                          <button onClick={() => save(t.id)} className="flex items-center gap-1 text-xs px-3 py-1 rounded bg-primary text-primary-foreground">
                            <Save className="size-3" /> 저장
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${t.type === "absence" ? "bg-orange-100 text-orange-700" : "bg-purple-100 text-purple-700"}`}>
                              {TYPE_OPTIONS.find(o => o.value === t.type)?.label}
                            </span>
                            <span className="text-sm font-medium">{t.title}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => toggleActive(t)}
                              className={`text-[10px] px-2 py-0.5 rounded-full border ${t.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-border/40"}`}
                            >
                              {t.active ? "활성" : "비활성"}
                            </button>
                            <button onClick={() => { setEditingId(t.id); setEditDraft({}); }} className="text-xs text-primary hover:underline">수정</button>
                            {isSuperAdmin && (
                              <button onClick={() => del(t.id)} className="text-xs text-red-500 hover:underline">
                                <Trash2 className="size-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2.5 whitespace-pre-wrap">{t.content}</div>
                        <div className="text-right text-[10px] text-muted-foreground mt-1">{t.content.length}자</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
