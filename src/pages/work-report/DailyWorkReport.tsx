// ============================================================
// 일일 업무보고 — activity_logs 기반 자동 생성 + 카톡 복사
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { WorkReportHeader, SectionCard } from './_shared';
import { LogDetailModal, type LogDetailFilter } from './LogDetailModal';
import { getDailyWorkReportData, type DailyReportData } from '@/services/workReport/reportAggregationService';
import { formatDailyKakaoReport, copyDailyReportToClipboard, maskCustomerName } from '@/services/workReport/reportFormatService';

const CHANNEL_OPTIONS = ['전체', 'meta', 'dogmaru', 'udak'];
const CHANNEL_LABEL: Record<string, string> = { meta: '메타', dogmaru: '도그마루', udak: '유닥', 전체: '전체' };

const SUMMARY_ITEMS = [
  { key: 'call_attempt',         label: '통화시도',  color: 'text-blue-600' },
  { key: 'call_connected',       label: '연결완료',  color: 'text-indigo-600' },
  { key: 'absent',               label: '부재',      color: 'text-orange-500' },
  { key: 'recare',               label: '재케어',    color: 'text-yellow-600' },
  { key: 'failed',               label: '실패',      color: 'text-red-500' },
  { key: 'consultation_success', label: '상담성공',  color: 'text-green-600' },
  { key: 'delivery_sent',        label: '택배발송',  color: 'text-sky-600' },
  { key: 'activation_completed', label: '개통완료',  color: 'text-pink-600' },
] as const;

export default function DailyWorkReport() {
  const { user } = useAuth();
  const { isAdmin, isManager, loading: roleLoading } = useRole();
  const canViewAll = isAdmin || isManager;

  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [channel, setChannel] = useState('전체');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<DailyReportData | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [detailFilter, setDetailFilter] = useState<LogDetailFilter | null>(null);

  const openDetail = (filter: LogDetailFilter) => setDetailFilter(filter);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getDailyWorkReportData({
        date,
        userId: user.id,
        isAdmin: canViewAll,
        channel: channel === '전체' ? undefined : channel,
      });
      setReportData(data);
    } catch (e: any) {
      toast.error('보고서 생성 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [user, date, channel, canViewAll]);

  // roleLoading 완료 시점 + 조건 변경 시 재조회
  useEffect(() => {
    if (!roleLoading) load();
  }, [roleLoading, load]);

  const reportText = reportData ? formatDailyKakaoReport(reportData) : '';

  const handleCopy = async () => {
    const ok = await copyDailyReportToClipboard(reportText);
    if (ok) toast.success('카톡 보고문이 복사되었습니다.');
    else toast.error('복사에 실패했습니다. 다시 시도해주세요.');
  };

  const s = reportData?.summary;

  return (
    <div className="space-y-5">
      <WorkReportHeader
        title="일일 업무보고"
        description="activity_logs 기반으로 날짜별 업무보고를 자동 생성합니다."
        rightSlot={
          <>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
            />
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
            >
              {CHANNEL_OPTIONS.map((c) => (
                <option key={c} value={c}>{CHANNEL_LABEL[c] ?? c}</option>
              ))}
            </select>
            <button
              onClick={load}
              className="flex items-center gap-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-500 hover:text-gray-700"
            >
              <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs bg-pink-500 hover:bg-pink-600 text-white rounded-lg px-3 py-1.5 font-medium transition-colors"
            >
              <Copy className="size-3" />카톡 보고문 복사
            </button>
          </>
        }
      />

      {detailFilter && (
        <LogDetailModal filter={detailFilter} onClose={() => setDetailFilter(null)} />
      )}

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">보고서 생성 중...</div>
      ) : !reportData ? null : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* 왼쪽: 항목별 상세 */}
          <div className="space-y-4">

            {/* 전체 요약 */}
            <SectionCard title="전체 요약">
              <div className="grid grid-cols-4 gap-2">
                {SUMMARY_ITEMS.map(({ key, label, color }) => {
                  const actionMap: Record<string, string[]> = {
                    call_attempt: ['call_attempt'],
                    call_connected: ['call_connected'],
                    absent: ['absent'],
                    recare: ['recare_registered','recare_completed'],
                    failed: ['failed'],
                    consultation_success: ['consultation_success'],
                    delivery_sent: ['delivery_sent'],
                    activation_completed: ['activation_completed'],
                  };
                  const actions = actionMap[key];
                  return (
                    <div
                      key={key}
                      onClick={() => actions && openDetail({
                        title: `${label} 상세`,
                        dateFrom: date, dateTo: date,
                        actionTypes: actions as any,
                      })}
                      className={`bg-gray-50 rounded-xl border border-gray-100 p-3 text-center cursor-pointer hover:shadow-md hover:border-pink-200 transition-all`}
                    >
                      <div className={`text-xl font-bold ${color}`}>{(s as any)?.[key] ?? 0}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
                    </div>
                  );
                })}
              </div>
              {(s?.not_counted ?? 0) > 0 && (
                <p className="text-[11px] text-gray-400 mt-2">미인정 로그 {s!.not_counted}건 제외됨</p>
              )}
            </SectionCard>

            {/* 개통 완료건 */}
            <SectionCard title={`개통 완료건 (${reportData.activationLogs.length}건)`}>
              {reportData.activationLogs.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">없음</p>
              ) : (
                <div className="space-y-1.5">
                  {reportData.activationLogs.map((log, i) => (
                    <div key={log.id} className="flex items-center gap-2 text-xs bg-green-50 rounded-lg px-3 py-2 border border-green-100">
                      <span className="text-green-600 font-bold w-4 shrink-0">{i + 1}</span>
                      <span className="font-medium">{log.staff_name}</span>
                      <span className="text-gray-300">/</span>
                      <span className="text-gray-500">{CHANNEL_LABEL[log.channel ?? ''] ?? log.channel ?? '-'}</span>
                      <span className="text-gray-300">/</span>
                      <span className="font-medium">{maskCustomerName(log.customer_name)}</span>
                      {log.memo && <><span className="text-gray-300">/</span><span className="text-gray-500">{log.memo}</span></>}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* 진행 예정건 */}
            <SectionCard title={`진행 예정건 (${reportData.progressLogs.length}건)`}>
              {reportData.progressLogs.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">없음</p>
              ) : (
                <div className="space-y-1.5">
                  {reportData.progressLogs.map((log, i) => (
                    <div key={log.id} className="flex items-center gap-2 text-xs bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
                      <span className="text-blue-600 font-bold w-4 shrink-0">{i + 1}</span>
                      <span className="font-medium">{log.staff_name}</span>
                      <span className="text-gray-300">/</span>
                      <span className="text-gray-500">{CHANNEL_LABEL[log.channel ?? ''] ?? log.channel ?? '-'}</span>
                      <span className="text-gray-300">/</span>
                      <span className="font-medium">{maskCustomerName(log.customer_name)}</span>
                      <span className="text-gray-300">/</span>
                      <span className="text-blue-600">{log.next_status ?? '진행중'}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* 실패 요약 */}
            <SectionCard title="실패 요약">
              {reportData.failReasons.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">없음</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {reportData.failReasons.map((f) => (
                    <div key={f.reason} className="flex justify-between items-center text-xs bg-red-50 rounded-lg px-3 py-2 border border-red-100">
                      <span className="text-gray-700">{f.reason}</span>
                      <span className="font-bold text-red-500">{f.count}건</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* 담당자별 */}
            <SectionCard title="담당자별 요약">
              {reportData.staffSummaries.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">데이터 없음</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100">
                      {['담당자', '시도', '연결', '부재', '재케어', '실패', '성공', '개통'].map((h) => (
                        <th key={h} className={`py-2 font-medium ${h === '담당자' ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {reportData.staffSummaries.map((s) => (
                      <tr key={s.staff_id} className="text-gray-700">
                        <td className="py-2 font-medium">{s.display_name}</td>
                        {[
                          { val: s.call_attempt, actions: ['call_attempt'], label: '통화시도', color: 'text-gray-700' },
                          { val: s.call_connected, actions: ['call_connected'], label: '연결완료', color: 'text-indigo-600' },
                          { val: s.absent, actions: ['absent'], label: '부재', color: 'text-orange-500' },
                          { val: s.recare, actions: ['recare_registered','recare_completed'], label: '재케어', color: 'text-yellow-600' },
                          { val: s.failed, actions: ['failed'], label: '실패', color: 'text-red-500' },
                          { val: s.consultation_success, actions: ['consultation_success'], label: '상담성공', color: 'text-green-600 font-bold' },
                          { val: s.activation_completed, actions: ['activation_completed'], label: '개통완료', color: 'text-pink-600 font-bold' },
                        ].map(({ val, actions, label, color }) => (
                          <td key={label} className="py-2 text-right">
                            <button
                              onClick={() => val > 0 && openDetail({
                                title: `${s.display_name} · ${label} 상세`,
                                dateFrom: date, dateTo: date,
                                actionTypes: actions as any,
                                staffId: s.staff_id,
                              })}
                              className={`${color} ${val > 0 ? 'hover:underline cursor-pointer' : 'cursor-default'}`}
                            >
                              {val}
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </SectionCard>
          </div>

          {/* 오른쪽: 카톡 보고문 미리보기 */}
          <div className="space-y-4">
            <SectionCard
              title="카톡 보고문 미리보기"
              rightSlot={
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-xs bg-pink-500 hover:bg-pink-600 text-white rounded-lg px-3 py-1.5 font-medium transition-colors"
                  >
                    <Copy className="size-3" />복사
                  </button>
                  <button
                    onClick={() => setShowPreview((v) => !v)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showPreview ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </button>
                </div>
              }
            >
              {showPreview && (
                <pre className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-mono bg-gray-50 rounded-lg p-4 border border-gray-100 max-h-[600px] overflow-y-auto">
                  {reportText || '데이터가 없습니다.'}
                </pre>
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
}
