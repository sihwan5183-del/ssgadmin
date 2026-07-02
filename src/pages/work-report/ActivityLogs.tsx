// ============================================================
// 활동 로그 — 실제 activity_logs 데이터 조회 (2-1단계)
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { resolveStaffDisplayNames, normalizeStaffName } from '@/services/workReport/staffDisplayService';
import { WorkReportHeader, SectionCard, WRBadge } from './_shared';
import { getKstTodayString } from '@/services/workReport/dateUtils';
import {
  fetchActivityLogs,
  insertActivityLog,
  cancelActivityLog,
} from '@/services/workReport/activityLogService';
import { getAbsentRepeatCases, type AbsentRepeatCase } from '@/services/workReport/absentRepeatService';
import {
  ACTION_TYPE_LABEL,
  type ActivityLogWithLead,
  type ActivityActionType,
  type ActivityLogFilter,
} from '@/types/workReport';

const ACTION_OPTIONS = Object.entries(ACTION_TYPE_LABEL).map(([value, label]) => ({
  value,
  label,
}));

const COUNTED_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'true', label: '인정' },
  { value: 'false', label: '미인정' },
];


// 로그 취소 모달 (is_counted = false 처리)
function CancelModal({
  logId,
  onClose,
  onDone,
  userId,
}: {
  logId: string;
  onClose: () => void;
  onDone: () => void;
  userId: string;
}) {
  const [reason, setReason] = useState<'실수' | '중복' | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    if (!reason) return toast.error('사유를 선택해주세요.');
    setLoading(true);
    try {
      await cancelActivityLog({ logId, reason, cancelledBy: userId });
      toast.success('로그가 집계에서 제외되었습니다.');
      onDone();
      onClose();
    } catch (e: any) {
      toast.error('처리 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-bold text-gray-900 mb-1">로그 집계 제외</h3>
        <p className="text-xs text-gray-400 mb-4">사유 선택 시 해당 로그는 집계에서 제외됩니다. (기록은 유지)</p>
        <div className="space-y-2">
          {(['실수', '중복'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setReason(reason === r ? null : r)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                reason === r
                  ? 'border-pink-400 bg-pink-50 text-pink-700'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {r === '실수' ? '✋ 실수로 눌렀어요' : '🔁 중복 입력이에요'}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={handleCancel}
            disabled={!reason || loading}
            className="flex-1 bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium rounded-lg py-2 transition-colors disabled:opacity-40"
          >
            {loading ? '처리 중...' : '집계 제외'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg py-2 hover:bg-gray-50"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

// 테스트 로그 삽입용 모달
function TestLogModal({
  onClose,
  onInserted,
  userId,
}: {
  onClose: () => void;
  onInserted: () => void;
  userId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    staff_name: '테스트직원',
    action_type: 'call_attempt' as ActivityActionType,
    result_type: '부재',
    previous_status: '신규접수',
    next_status: '부재',
    memo: '1차 부재 테스트',
    is_counted: true,
    not_counted_reason: '',
  });

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await insertActivityLog({
        lead_id: null,
        sales_record_id: null,
        staff_id: userId,
        staff_name: form.staff_name,
        store_id: null,
        channel: null,
        action_type: form.action_type,
        result_type: form.result_type || null,
        previous_status: form.previous_status || null,
        next_status: form.next_status || null,
        memo: form.memo || null,
        fail_reason: null,
        next_action_at: null,
        is_counted: form.is_counted,
        not_counted_reason: form.not_counted_reason || null,
        corrected_log_id: null,
        device_info: null,
        ip_address: null,
        created_by: userId,
      });
      toast.success('테스트 로그가 저장되었습니다.');
      onInserted();
      onClose();
    } catch (e: any) {
      toast.error('저장 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-base font-bold text-gray-900 mb-4">테스트 로그 생성</h3>
        <div className="space-y-3">
          {[
            { label: '담당자명', key: 'staff_name' },
            { label: '결과', key: 'result_type' },
            { label: '이전상태', key: 'previous_status' },
            { label: '변경상태', key: 'next_status' },
            { label: '메모', key: 'memo' },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="text-xs text-gray-500 font-medium">{label}</label>
              <input
                value={(form as any)[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-pink-300"
              />
            </div>
          ))}
          <div>
            <label className="text-xs text-gray-500 font-medium">행동유형</label>
            <select
              value={form.action_type}
              onChange={(e) => setForm((f) => ({ ...f, action_type: e.target.value as ActivityActionType }))}
              className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
            >
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_counted"
              checked={form.is_counted}
              onChange={(e) => setForm((f) => ({ ...f, is_counted: e.target.checked }))}
              className="rounded accent-pink-500"
            />
            <label htmlFor="is_counted" className="text-sm text-gray-700">업무량 인정</label>
          </div>
          {!form.is_counted && (
            <div>
              <label className="text-xs text-gray-500 font-medium">미인정 사유</label>
              <input
                value={form.not_counted_reason}
                onChange={(e) => setForm((f) => ({ ...f, not_counted_reason: e.target.value }))}
                className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-pink-300"
              />
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium rounded-lg py-2 transition-colors disabled:opacity-50"
          >
            {loading ? '저장 중...' : '저장'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg py-2 hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function ActivityLogs() {
  const { user } = useAuth();
  const { isAdmin, isManager, loading: roleLoading } = useRole();
  const canViewAll = isAdmin || isManager;
  const [logs, setLogs] = useState<ActivityLogWithLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [cancelLogId, setCancelLogId] = useState<string | null>(null);
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());

  const [repeatCases, setRepeatCases] = useState<AbsentRepeatCase[]>([]);
  const [filter, setFilter] = useState<ActivityLogFilter>({
    dateFrom: getKstTodayString(),
    dateTo: getKstTodayString(),
    staffId: '',
    actionType: '',
    isCounted: null,
    anomalyOnly: false,
  });

  const load = useCallback(async () => {
    if (roleLoading || !user) return;
    setLoading(true);
    try {
      // 직원은 본인 로그만 조회
      const effectiveFilter = {
        ...filter,
        staffId: canViewAll ? (filter.staffId || undefined) : user.id,
        isCounted: filter.anomalyOnly ? false : filter.isCounted,
        anomalyOnly: false,
      };
      const data = await fetchActivityLogs(effectiveFilter);
      setLogs(data);
      // 반복 부재 감지
      const repeats = await getAbsentRepeatCases(
        filter.dateFrom ?? getKstTodayString(),
        filter.dateTo ?? getKstTodayString(),
        canViewAll ? (filter.staffId || undefined) : user?.id
      );
      setRepeatCases(repeats);
      // 담당자 표시명 일괄 조회
      const staffIds = [...new Set(data.map((l) => l.staff_id))];
      if (staffIds.length > 0) {
        const map = await resolveStaffDisplayNames(staffIds);
        setNameMap(map);
      }
    } catch (e: any) {
      toast.error('로그 조회 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [filter, canViewAll]);

  useEffect(() => {
    if (roleLoading) return;
    if (!user) return;
    load();
  }, [load, roleLoading, user]);

  const totalCount = logs.length;
  const countedCount = logs.filter((l) => l.is_counted).length;
  const notCountedCount = logs.filter((l) => !l.is_counted).length;

  // 담당자별 집계 (현재 필터 기준)
  const staffSummary = (() => {
    const map = new Map<string, {
      name: string;
      total: number;
      counted: number;
      call_attempt: number;
      absent: number;
      recare: number;
      failed: number;
      consultation_success: number;
      activation_completed: number;
    }>();
    for (const l of logs) {
      const id = l.staff_id;
      const name = nameMap.get(id) ?? l.staff_name ?? id.slice(0, 6);
      if (!map.has(id)) map.set(id, {
        name, total: 0, counted: 0,
        call_attempt: 0, absent: 0, recare: 0,
        failed: 0, consultation_success: 0, activation_completed: 0,
      });
      const s = map.get(id)!;
      s.total++;
      if (l.is_counted) s.counted++;
      if (l.action_type === 'call_attempt') s.call_attempt++;
      if (l.action_type === 'absent') s.absent++;
      if (l.action_type === 'recare_registered' || l.action_type === 'recare_completed') s.recare++;
      if (l.action_type === 'failed') s.failed++;
      if (l.action_type === 'consultation_success') s.consultation_success++;
      if (l.action_type === 'activation_completed') s.activation_completed++;
    }
    return Array.from(map.values()).sort((a, b) => b.counted - a.counted);
  })();

  return (
    <div className="space-y-5">
      {showTestModal && user && (
        <TestLogModal
          userId={user.id}
          onClose={() => setShowTestModal(false)}
          onInserted={load}
        />
      )}
      {cancelLogId && user && (
        <CancelModal
          logId={cancelLogId}
          userId={user.id}
          onClose={() => setCancelLogId(null)}
          onDone={load}
        />
      )}

      <WorkReportHeader
        title="활동 로그"
        description="직원 행동 로그 전체 조회. 업무량 인정/미인정 기준으로 필터링할 수 있습니다."
        rightSlot={
          <>
            <input
              type="date"
              value={filter.dateFrom}
              onChange={(e) => setFilter((f) => ({ ...f, dateFrom: e.target.value }))}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
            />
            <span className="text-xs text-gray-400">~</span>
            <input
              type="date"
              value={filter.dateTo}
              onChange={(e) => setFilter((f) => ({ ...f, dateTo: e.target.value }))}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
            />
            <select
              value={filter.actionType}
              onChange={(e) => setFilter((f) => ({ ...f, actionType: e.target.value as ActivityActionType | '' }))}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
            >
              <option value="">전체 행동</option>
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              value={filter.isCounted === null ? '' : String(filter.isCounted)}
              onChange={(e) => {
                const v = e.target.value;
                setFilter((f) => ({
                  ...f,
                  isCounted: v === '' ? null : v === 'true',
                }));
              }}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
            >
              {COUNTED_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filter.anomalyOnly}
                onChange={(e) => setFilter((f) => ({ ...f, anomalyOnly: e.target.checked }))}
                className="rounded accent-pink-500"
              />
              미인정만
            </label>
            <button
              onClick={load}
              className="flex items-center gap-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-500 hover:text-gray-700"
            >
              <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowTestModal(true)}
              className="flex items-center gap-1 text-xs bg-pink-500 hover:bg-pink-600 text-white rounded-lg px-3 py-1.5 font-medium transition-colors"
            >
              <Plus className="size-3" />테스트 로그
            </button>
          </>
        }
      />

      {/* 요약 통계 */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: '전체 로그', value: totalCount, color: 'text-gray-700' },
          { label: '인정', value: countedCount, color: 'text-green-600' },
          { label: '미인정', value: notCountedCount, color: 'text-red-500' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-5 py-3 text-center shadow-sm min-w-[100px]">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 담당자별 요약 카드 — 관리자만 */}
      {canViewAll && staffSummary.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {staffSummary.map((s) => (
            <div key={s.name} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              {/* 헤더 */}
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-gray-900 text-sm">{s.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">전체 {s.total}건</span>
                  <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">인정 {s.counted}건</span>
                </div>
              </div>
              {/* 행동 유형별 수치 */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '통화시도', value: s.call_attempt, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: '부재',     value: s.absent,       color: 'text-orange-500', bg: 'bg-orange-50' },
                  { label: '재케어',   value: s.recare,       color: 'text-yellow-600', bg: 'bg-yellow-50' },
                  { label: '실패',     value: s.failed,       color: 'text-red-500',   bg: 'bg-red-50' },
                  { label: '상담성공', value: s.consultation_success, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: '개통완료', value: s.activation_completed, color: 'text-pink-600',    bg: 'bg-pink-50' },
                ].map((item) => (
                  <div key={item.label} className={`rounded-xl ${item.bg} px-2 py-2 text-center`}>
                    <div className={`text-lg font-bold ${item.color}`}>{item.value}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>
              {/* 미인정 표시 */}
              {(s.total - s.counted) > 0 && (
                <div className="mt-2 text-[11px] text-red-400 text-right">
                  미인정 {s.total - s.counted}건 포함
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 반복 부재케어 감지 */}
      {repeatCases.length > 0 && (
        <SectionCard title={`⚠️ 반복 부재 고객 (${repeatCases.length}건) — 2회 이상`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100 bg-orange-50">
                  {['고객', '채널', '담당자', '부재 횟수', '마지막 부재'].map((h) => (
                    <th key={h} className="py-2 px-3 font-medium text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {repeatCases.map((c) => (
                  <tr key={c.lead_id} className="hover:bg-orange-50/50">
                    <td className="py-2 px-3 font-medium text-gray-800">
                      {c.customer_name ?? <span className="text-gray-300">-</span>}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        c.channel === 'dogmaru' ? 'bg-blue-100 text-blue-700' :
                        c.channel === 'udak' ? 'bg-purple-100 text-purple-700' :
                        c.channel === 'meta' ? 'bg-pink-100 text-pink-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>{c.channel ?? '-'}</span>
                    </td>
                    <td className="py-2 px-3 text-gray-600">{c.staff_name}</td>
                    <td className="py-2 px-3">
                      <span className={`font-bold ${c.absent_count >= 5 ? 'text-red-600' : c.absent_count >= 3 ? 'text-orange-500' : 'text-yellow-600'}`}>
                        {c.absent_count}회
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-400 font-mono">
                      {new Date(c.last_absent_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* 로그 테이블 */}
      <SectionCard>
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">로딩 중...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                  {['시간', '담당자', '채널', '고객(lead_id)', '행동유형', '결과', '이전상태', '변경상태', '인정여부', '미인정 사유', '메모', ''].map((h) => (
                    <th key={h} className="py-2.5 px-3 font-medium text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log) => {
                  const timeStr = new Date(log.created_at).toLocaleTimeString('ko-KR', {
                    hour: '2-digit', minute: '2-digit',
                  });
                  const dateStr = new Date(log.created_at).toLocaleDateString('ko-KR', {
                    month: '2-digit', day: '2-digit',
                  });
                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        !log.is_counted ? 'bg-red-50/40' :
                        (log.action_type === 'absent' && log.lead_id && repeatCases.some(c => c.lead_id === log.lead_id))
                          ? 'bg-orange-50/60' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-gray-400 text-xs whitespace-nowrap font-mono">
                        <div>{dateStr}</div>
                        <div>{timeStr}</div>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-gray-800 whitespace-nowrap">{normalizeStaffName(log.staff_name, nameMap.get(log.staff_id))}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {log.channel ? (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            log.channel === 'dogmaru' ? 'bg-blue-100 text-blue-700' :
                            log.channel === 'udak' ? 'bg-purple-100 text-purple-700' :
                            log.channel === 'meta' ? 'bg-pink-100 text-pink-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>{log.channel}</span>
                        ) : <span className="text-gray-300 text-xs">-</span>}
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 text-xs whitespace-nowrap">
                        {log.customer_name
                          ? <span className="text-gray-700">{log.customer_name}</span>
                          : log.lead_id
                            ? <span className="font-mono text-gray-400">{log.lead_id.slice(0, 8)}…</span>
                            : <span className="text-gray-300">-</span>
                        }
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <WRBadge variant="info">
                          {ACTION_TYPE_LABEL[log.action_type] ?? log.action_type}
                        </WRBadge>
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap text-xs">{log.result_type ?? '-'}</td>
                      <td className="py-2.5 px-3 text-gray-400 text-xs whitespace-nowrap">{log.previous_status ?? '-'}</td>
                      <td className="py-2.5 px-3 text-gray-700 text-xs whitespace-nowrap">{log.next_status ?? '-'}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <WRBadge variant={log.is_counted ? 'success' : 'danger'}>
                          {log.is_counted ? '인정' : '미인정'}
                        </WRBadge>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-red-400 whitespace-nowrap">
                        {log.not_counted_reason ?? '-'}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-500 max-w-[180px] truncate">
                        {log.memo ?? '-'}
                      </td>
                      <td className="py-2.5 px-3">
                        {log.is_counted && (
                          <button
                            onClick={() => setCancelLogId(log.id)}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors whitespace-nowrap"
                          >
                            제외
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-16 text-center text-sm text-gray-400">
                      조건에 맞는 로그가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

