// ============================================================
// 활동 로그 — 실제 activity_logs 데이터 조회 (2-1단계)
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { WorkReportHeader, SectionCard, WRBadge } from './_shared';
import {
  fetchActivityLogs,
  insertActivityLog,
} from '@/services/workReport/activityLogService';
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
  const [logs, setLogs] = useState<ActivityLogWithLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const [filter, setFilter] = useState<ActivityLogFilter>({
    dateFrom: today,
    dateTo: today,
    staffId: '',
    actionType: '',
    isCounted: null,
    anomalyOnly: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchActivityLogs(filter);
      setLogs(data);
    } catch (e: any) {
      toast.error('로그 조회 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const totalCount = logs.length;
  const countedCount = logs.filter((l) => l.is_counted).length;
  const notCountedCount = logs.filter((l) => !l.is_counted).length;

  return (
    <div className="space-y-5">
      {showTestModal && user && (
        <TestLogModal
          userId={user.id}
          onClose={() => setShowTestModal(false)}
          onInserted={load}
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

      {/* 로그 테이블 */}
      <SectionCard>
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">로딩 중...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                  {['시간', '담당자', '고객(lead_id)', '행동유형', '결과', '이전상태', '변경상태', '인정여부', '미인정 사유', '메모'].map((h) => (
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
                      className={`hover:bg-gray-50 transition-colors ${!log.is_counted ? 'bg-red-50/40' : ''}`}
                    >
                      <td className="py-2.5 px-3 text-gray-400 text-xs whitespace-nowrap font-mono">
                        <div>{dateStr}</div>
                        <div>{timeStr}</div>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-gray-800 whitespace-nowrap">{log.staff_name}</td>
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
