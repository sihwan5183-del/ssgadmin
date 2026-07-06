// ============================================================
// 사전예약 — 미케어 실시간 알림 시스템
// 20분 이상 신규 상태 유지 시 전직원 모달 알림
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, X, ExternalLink, Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatPhone } from '@/lib/phoneFormat';

const ALERT_THRESHOLD_MIN = 20; // 20분
const CHECK_INTERVAL_MS = 60 * 1000; // 1분마다 체크
const DISMISSED_KEY = 'reservation_alert_dismissed'; // 세션스토리지 키

interface UncaredReservation {
  id: string;
  name: string;
  phone: string;
  channel: string | null;
  contact_date: string;
  assigned_to: string | null;
  elapsed_min: number;
}

function getElapsedMin(contactDate: string): number {
  return Math.floor((Date.now() - new Date(contactDate).getTime()) / 60000);
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

// 채널 뱃지 색상
function ChannelBadge({ channel }: { channel: string | null }) {
  const color = channel === '메타광고' ? 'bg-blue-100 text-blue-700' :
    channel === '네이버 검색광고' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${color}`}>
      {channel ?? '기타'}
    </span>
  );
}

export function ReservationAlertSystem() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<UncaredReservation[]>([]);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const checkUncared = useCallback(async () => {
    if (!user) return;

    const cutoff = new Date(Date.now() - ALERT_THRESHOLD_MIN * 60 * 1000).toISOString();
    const dismissed = getDismissedIds();

    const { data, error } = await supabase
      .from('reservations')
      .select('id, name, phone, channel, contact_date, assigned_to')
      .eq('status', '신규')
      .lt('contact_date', cutoff)
      .order('contact_date', { ascending: true });

    if (error || !data) return;

    const uncared = data
      .filter(r => !dismissed.has(r.id))
      .map(r => ({
        ...r,
        elapsed_min: getElapsedMin(r.contact_date),
      })) as UncaredReservation[];

    if (uncared.length > 0) {
      setAlerts(uncared);
      setVisible(true);
      // 브라우저 알림 소리 (간단한 비프)
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
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

  const handleDismissOne = (id: string) => {
    addDismissedId(id);
    setAlerts(prev => {
      const next = prev.filter(a => a.id !== id);
      if (next.length === 0) setVisible(false);
      return next;
    });
  };

  const handleDismissAll = () => {
    alerts.forEach(a => addDismissedId(a.id));
    setAlerts([]);
    setVisible(false);
  };

  const handleGoToReservation = (id: string) => {
    addDismissedId(id);
    setAlerts(prev => {
      const next = prev.filter(a => a.id !== id);
      if (next.length === 0) setVisible(false);
      return next;
    });
    navigate(`/reservations?highlight=${id}`);
  };

  if (!visible || alerts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="bg-red-500 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
              <AlertTriangle className="size-4 text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-sm">🚨 미케어 고객 알림</div>
              <div className="text-red-100 text-xs mt-0.5">{alerts.length}건 · {ALERT_THRESHOLD_MIN}분 이상 대응 없음</div>
            </div>
          </div>
          <button onClick={handleDismissAll} className="text-white/70 hover:text-white transition-colors">
            <X className="size-5" />
          </button>
        </div>

        {/* 알림 목록 */}
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
          {alerts.map(alert => (
            <div key={alert.id} className="px-5 py-4 hover:bg-red-50/30 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <ChannelBadge channel={alert.channel} />
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      alert.elapsed_min >= 60 ? 'bg-red-100 text-red-600' :
                      alert.elapsed_min >= 30 ? 'bg-orange-100 text-orange-600' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {alert.elapsed_min >= 60
                        ? `${Math.floor(alert.elapsed_min / 60)}시간 ${alert.elapsed_min % 60}분 경과`
                        : `${alert.elapsed_min}분 경과`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{alert.name}</span>
                    <span className="text-sm text-gray-500">{formatPhone(alert.phone)}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    접수: {new Date(alert.contact_date).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleGoToReservation(alert.id)}
                    className="flex items-center gap-1 text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                  >
                    케어하기 <ExternalLink className="size-3" />
                  </button>
                  <button
                    onClick={() => handleDismissOne(alert.id)}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg border border-gray-200 transition-colors"
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
          <span className="text-xs text-gray-400">1분마다 자동 체크 · 세션 종료 시 초기화</span>
          <button
            onClick={handleDismissAll}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium"
          >
            모두 확인
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 상단 알림 아이콘 (알림 있을 때 빨간 뱃지) ──────────────
export function ReservationAlertBell() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (!user) return;
      const cutoff = new Date(Date.now() - ALERT_THRESHOLD_MIN * 60 * 1000).toISOString();
      const dismissed = getDismissedIds();
      const { count: c } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('status', '신규')
        .lt('contact_date', cutoff);
      setCount(Math.max(0, (c ?? 0) - dismissed.size));
    };
    check();
    const t = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(t);
  }, [user]);

  return (
    <button
      onClick={() => setShowPanel(!showPanel)}
      className="relative p-2 rounded-lg hover:bg-red-50 transition-colors"
      title="미케어 알림"
    >
      <Bell className={`size-5 ${count > 0 ? 'text-red-500' : 'text-gray-400'}`} />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}
