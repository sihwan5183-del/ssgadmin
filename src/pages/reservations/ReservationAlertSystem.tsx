// ============================================================
// 미케어 실시간 알림 시스템 (통합)
// leads (메타/도그마루/기타) + reservations (사전예약)
// 20분 이상 신규 상태 유지 시 전직원 모달 알림
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, X, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const ALERT_THRESHOLD_MIN = 20;
const CHECK_INTERVAL_MS = 60 * 1000;
const DISMISSED_KEY = 'uncared_alert_dismissed_v2';

interface UncaredItem {
  id: string;
  name: string;
  phone: string;
  channel: string;
  source: 'leads' | 'reservations';
  contact_date: string;
  elapsed_min: number;
}

function getElapsedMin(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

function getDismissedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function addDismissedId(id: string) {
  try {
    const ids = getDismissedIds();
    ids.add(id);
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {}
}

function SourceBadge({ item }: { item: UncaredItem }) {
  // 채널별 색상
  const colorMap: Record<string, string> = {
    '메타광고':       'bg-blue-100 text-blue-700',
    '도그마루':       'bg-amber-100 text-amber-700',
    '네이버 검색광고':'bg-green-100 text-green-700',
    '유닥':           'bg-purple-100 text-purple-700',
    '올인원':         'bg-indigo-100 text-indigo-700',
    '사전예약':       'bg-pink-100 text-pink-700',
  };
  const color = colorMap[item.channel] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>
      {item.channel}
    </span>
  );
}

function ElapsedBadge({ min }: { min: number }) {
  const color = min >= 60 ? 'bg-red-100 text-red-600' :
    min >= 40 ? 'bg-orange-100 text-orange-600' : 'bg-yellow-100 text-yellow-700';
  const label = min >= 60
    ? `${Math.floor(min / 60)}시간 ${min % 60}분`
    : `${min}분`;
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{label} 경과</span>;
}

export function ReservationAlertSystem() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<UncaredItem[]>([]);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkUncared = useCallback(async () => {
    if (!user) return;
    const cutoff = new Date(Date.now() - ALERT_THRESHOLD_MIN * 60 * 1000).toISOString();
    const dismissed = getDismissedIds();
    const results: UncaredItem[] = [];

    // ── 1. leads 테이블 (메타/도그마루/유닥/올인원/기타) ──
    const { data: leadsData } = await supabase
      .from('leads')
      .select('id, customer_name, name, customer_phone, phone, source, channel, created_at')
      .eq('status', '신규 접수')
      .lt('created_at', cutoff)
      .is('deleted_at', null);

    (leadsData ?? []).forEach((r: any) => {
      const id = `leads_${r.id}`;
      if (dismissed.has(id)) return;
      const channelMap: Record<string, string> = {
        'meta': '메타광고', 'dogmaru': '도그마루',
        'udak': '유닥', 'allinone': '올인원',
      };
      const channel = r.channel ?? channelMap[r.source] ?? '기타인입';
      results.push({
        id,
        name: r.customer_name ?? r.name ?? '이름없음',
        phone: r.customer_phone ?? r.phone ?? '',
        channel,
        source: 'leads',
        contact_date: r.created_at,
        elapsed_min: getElapsedMin(r.created_at),
      });
    });

    // ── 2. reservations 테이블 (사전예약) ──
    const { data: resData } = await supabase
      .from('reservations')
      .select('id, name, phone, channel, contact_date')
      .eq('status', '신규')
      .lt('contact_date', cutoff);

    (resData ?? []).forEach((r: any) => {
      const id = `res_${r.id}`;
      if (dismissed.has(id)) return;
      results.push({
        id,
        name: r.name,
        phone: r.phone,
        channel: r.channel ?? '사전예약',
        source: 'reservations',
        contact_date: r.contact_date,
        elapsed_min: getElapsedMin(r.contact_date),
      });
    });

    // 경과시간 내림차순 정렬 (오래된 거 먼저)
    results.sort((a, b) => b.elapsed_min - a.elapsed_min);

    if (results.length > 0) {
      setAlerts(results);
      setVisible(true);
      // 알림음
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        [880, 1100].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
          osc.start(ctx.currentTime + i * 0.15);
          osc.stop(ctx.currentTime + i * 0.15 + 0.3);
        });
      } catch {}
    } else {
      setAlerts([]);
      setVisible(false);
    }
  }, [user]);

  useEffect(() => {
    checkUncared();
    intervalRef.current = setInterval(checkUncared, CHECK_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [checkUncared]);

  const dismiss = (id: string) => {
    addDismissedId(id);
    setAlerts(prev => {
      const next = prev.filter(a => a.id !== id);
      if (next.length === 0) setVisible(false);
      return next;
    });
  };

  const dismissAll = () => {
    alerts.forEach(a => addDismissedId(a.id));
    setAlerts([]); setVisible(false);
  };

  const goTo = (item: UncaredItem) => {
    addDismissedId(item.id);
    setAlerts(prev => {
      const next = prev.filter(a => a.id !== item.id);
      if (next.length === 0) setVisible(false);
      return next;
    });
    if (item.source === 'reservations') {
      navigate('/reservations');
    } else {
      navigate('/leads');
    }
  };

  if (!visible || alerts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

        {/* 헤더 */}
        <div className="bg-red-500 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center animate-pulse shrink-0">
              <AlertTriangle className="size-5 text-white" />
            </div>
            <div>
              <div className="text-white font-bold">🚨 미케어 고객 알림</div>
              <div className="text-red-100 text-xs mt-0.5">
                {alerts.length}건 · {ALERT_THRESHOLD_MIN}분 이상 대응 없음
              </div>
            </div>
          </div>
          <button onClick={dismissAll} className="text-white/70 hover:text-white">
            <X className="size-5" />
          </button>
        </div>

        {/* 알림 목록 */}
        <div className="max-h-[55vh] overflow-y-auto divide-y divide-gray-100">
          {alerts.map(alert => (
            <div key={alert.id} className="px-5 py-3.5 hover:bg-red-50/30 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    <SourceBadge item={alert} />
                    <ElapsedBadge min={alert.elapsed_min} />
                    {alert.source === 'reservations' && (
                      <span className="text-[10px] text-pink-500 font-semibold">사전예약</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{alert.name}</span>
                    <span className="text-sm text-gray-500">{alert.phone}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    접수: {new Date(alert.contact_date).toLocaleString('ko-KR', {
                      month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => goTo(alert)}
                    className="flex items-center gap-1 text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
                  >
                    케어하기 <ExternalLink className="size-3" />
                  </button>
                  <button
                    onClick={() => dismiss(alert.id)}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2.5 py-1.5 rounded-lg border border-gray-200"
                  >
                    확인
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 하단 */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">1분마다 자동 체크</span>
          <button onClick={dismissAll} className="text-xs text-gray-500 hover:text-gray-700 font-medium">
            모두 확인
          </button>
        </div>
      </div>
    </div>
  );
}

