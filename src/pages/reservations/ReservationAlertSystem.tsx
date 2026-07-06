// ============================================================
// 미케어 실시간 알림 — 채널별 분리 토스트
// leads (메타/도그마루/기타) + reservations (사전예약)
// 7월 1일 이후 인입건 중 20분 이상 신규 상태
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, X, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const ALERT_THRESHOLD_MIN = 20;
const CHECK_INTERVAL_MS = 60 * 1000;
const DISMISSED_KEY = 'uncared_alert_v3';
const START_DATE = '2026-07-01T00:00:00+09:00';

interface UncaredItem {
  id: string;
  name: string;
  phone: string;
  channel: string;
  channelKey: string; // 'meta' | 'dogmaru' | 'reservation' | 'other'
  source: 'leads' | 'reservations';
  contact_date: string;
  elapsed_min: number;
}

const CHANNEL_CONFIG: Record<string, { label: string; color: string; bg: string; path: string }> = {
  meta:        { label: '메타광고',   color: '#1d4ed8', bg: '#dbeafe', path: '/leads?tab=meta' },
  dogmaru:     { label: '도그마루',   color: '#92400e', bg: '#fef3c7', path: '/leads?tab=dogmaru' },
  reservation: { label: '사전예약',   color: '#be185d', bg: '#fce7f3', path: '/reservations' },
  other:       { label: '기타인입',   color: '#374151', bg: '#f3f4f6', path: '/leads?tab=other' },
};

function getChannelKey(source: string | null, channel: string | null, tableSource: 'leads' | 'reservations'): string {
  if (tableSource === 'reservations') return 'reservation';
  if (source === 'dogmaru' || channel === '도그마루') return 'dogmaru';
  if (source === 'meta' || channel === '메타광고') return 'meta';
  return 'other';
}

function getElapsedMin(d: string) { return Math.floor((Date.now() - new Date(d).getTime()) / 60000); }
function getDismissed(): Set<string> { try { return new Set(JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? '[]')); } catch { return new Set(); } }
function addDismissed(id: string) { try { const s = getDismissed(); s.add(id); sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...s])); } catch {} }

export function ReservationAlertSystem() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [byChannel, setByChannel] = useState<Record<string, UncaredItem[]>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const check = useCallback(async () => {
    if (!user) return;
    const cutoff = new Date(Date.now() - ALERT_THRESHOLD_MIN * 60 * 1000).toISOString();
    const dismissed = getDismissed();
    const results: UncaredItem[] = [];

    // leads
    const { data: ld } = await supabase
      .from('leads')
      .select('id, customer_name, name, customer_phone, phone, source, channel, created_at')
      .eq('status', '신규 접수')
      .lt('created_at', cutoff)
      .gte('created_at', START_DATE)
      .is('deleted_at', null);

    (ld ?? []).forEach((r: any) => {
      const id = `leads_${r.id}`;
      if (dismissed.has(id)) return;
      // 7월 1일 이전 건 제외 (이중 필터)
      if (new Date(r.created_at) < new Date('2026-07-01T00:00:00+09:00')) return;
      const ck = getChannelKey(r.source, r.channel, 'leads');
      results.push({ id, name: r.customer_name ?? r.name ?? '이름없음', phone: r.customer_phone ?? r.phone ?? '', channel: CHANNEL_CONFIG[ck].label, channelKey: ck, source: 'leads', contact_date: r.created_at, elapsed_min: getElapsedMin(r.created_at) });
    });

    // reservations
    const { data: rd } = await supabase
      .from('reservations')
      .select('id, name, phone, channel, contact_date')
      .eq('status', '신규')
      .lt('contact_date', cutoff)
      .gte('contact_date', START_DATE);

    (rd ?? []).forEach((r: any) => {
      const id = `res_${r.id}`;
      if (dismissed.has(id)) return;
      if (new Date(r.contact_date) < new Date('2026-07-01T00:00:00+09:00')) return;
      results.push({ id, name: r.name, phone: r.phone, channel: '사전예약', channelKey: 'reservation', source: 'reservations', contact_date: r.contact_date, elapsed_min: getElapsedMin(r.contact_date) });
    });

    // 채널별로 그룹핑
    const grouped: Record<string, UncaredItem[]> = {};
    results.forEach(item => {
      if (!grouped[item.channelKey]) grouped[item.channelKey] = [];
      grouped[item.channelKey].push(item);
    });
    Object.values(grouped).forEach(arr => arr.sort((a, b) => b.elapsed_min - a.elapsed_min));

    setByChannel(grouped);

    // 알림음
    if (results.length > 0) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        [880, 1100].forEach((freq, i) => {
          const osc = ctx.createOscillator(); const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
          osc.start(ctx.currentTime + i * 0.15); osc.stop(ctx.currentTime + i * 0.15 + 0.3);
        });
      } catch {}
    }
  }, [user]);

  useEffect(() => {
    check();
    intervalRef.current = setInterval(check, CHECK_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [check]);

  const totalCount = Object.values(byChannel).reduce((s, arr) => s + arr.length, 0);
  if (totalCount === 0) return null;

  const dismiss = (id: string, channelKey: string) => {
    addDismissed(id);
    setByChannel(prev => {
      const next = { ...prev };
      next[channelKey] = (next[channelKey] ?? []).filter(a => a.id !== id);
      if (next[channelKey].length === 0) delete next[channelKey];
      return next;
    });
  };

  const dismissChannel = (channelKey: string) => {
    (byChannel[channelKey] ?? []).forEach(a => addDismissed(a.id));
    setByChannel(prev => { const next = { ...prev }; delete next[channelKey]; return next; });
  };

  return (
    <div className="fixed bottom-4 right-4 z-[45] w-full max-w-sm space-y-2 pointer-events-none">
      {Object.entries(byChannel).map(([ck, items]) => {
        const cfg = CHANNEL_CONFIG[ck] ?? CHANNEL_CONFIG.other;
        const isCollapsed = collapsed[ck];
        return (
          <div key={ck} className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-red-100 pointer-events-auto">
            {/* 채널 헤더 */}
            <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: cfg.bg }}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-3.5 shrink-0" style={{ color: cfg.color }} />
                <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: cfg.color }}>
                  {items.length}건 미케어
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setCollapsed(p => ({ ...p, [ck]: !p[ck] }))} className="p-1 rounded hover:bg-black/5">
                  {isCollapsed ? <ChevronDown className="size-3.5" style={{ color: cfg.color }} /> : <ChevronUp className="size-3.5" style={{ color: cfg.color }} />}
                </button>
                <button onClick={() => dismissChannel(ck)} className="p-1 rounded hover:bg-black/5">
                  <X className="size-3.5" style={{ color: cfg.color }} />
                </button>
              </div>
            </div>

            {/* 목록 */}
            {!isCollapsed && (
              <div className="max-h-[40vh] overflow-y-auto divide-y divide-gray-100">
                {items.map(item => (
                  <div key={item.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            item.elapsed_min >= 60 ? 'bg-red-100 text-red-600' :
                            item.elapsed_min >= 40 ? 'bg-orange-100 text-orange-600' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {item.elapsed_min >= 60 ? `${Math.floor(item.elapsed_min/60)}시간 ${item.elapsed_min%60}분` : `${item.elapsed_min}분`} 경과
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-gray-900">{item.name}</span>
                          <span className="text-xs text-gray-500">{item.phone}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(item.contact_date).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          onClick={() => { addDismissed(item.id); navigate(cfg.path); }}
                          className="flex items-center gap-1 text-xs text-white px-2.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
                          style={{ backgroundColor: cfg.color }}
                        >
                          케어 <ExternalLink className="size-3" />
                        </button>
                        <button
                          onClick={() => dismiss(item.id, ck)}
                          className="text-xs text-gray-400 hover:text-gray-600 px-2.5 py-1.5 rounded-lg border border-gray-200 text-center"
                        >
                          확인
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 하단 */}
            {!isCollapsed && (
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                <span className="text-[10px] text-gray-400">1분마다 자동 체크 · 7월 1일~</span>
                <button onClick={() => dismissChannel(ck)} className="text-[11px] text-gray-500 font-medium">모두 확인</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

