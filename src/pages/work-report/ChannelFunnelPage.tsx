// ============================================================
// 채널별 퍼널 분석 — 부재케어 / 재케어 전환율 / 성공률 실시간 체크
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronRight, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { WorkReportHeader, SectionCard } from './_shared';
import {
  getChannelFunnelData, getStaffFunnelData, getFunnelDrillLeads,
  buildFunnelDateRange,
  CHANNEL_LABEL, CHANNEL_KEYS,
  type ChannelFunnelRow, type StaffFunnelRow, type FunnelLeadRow,
  type DrillType, type ChannelKey,
} from '@/services/workReport/channelFunnelService';

const PERIOD_OPTIONS = ['오늘', '전일', '이번주', '이번달', '전체', '직접선택'] as const;
type Period = typeof PERIOD_OPTIONS[number];

// ── 드릴다운 모달 ─────────────────────────────────────────────
function DrillModal({
  title, leads, onClose,
}: {
  title: string;
  leads: FunnelLeadRow[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="text-base font-bold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-400 mt-0.5">총 {leads.length}건</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="size-4 text-gray-500" />
          </button>
        </div>
        {/* 목록 */}
        <div className="overflow-y-auto flex-1">
          {leads.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">해당 건이 없습니다</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 border-b">
                <tr>
                  {['고객명', '연락처', '담당자', '채널', '현재상태', '마지막액션', '경과일'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leads.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50/50">
                    <td className="px-3 py-2.5 font-medium text-gray-900">{l.customer_name}</td>
                    <td className="px-3 py-2.5 text-gray-500">{l.customer_phone ?? '-'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{l.assigned_name}</td>
                    <td className="px-3 py-2.5">
                      <span className="px-1.5 py-0.5 rounded bg-pink-50 text-pink-600 font-medium">
                        {CHANNEL_LABEL[l.channel] ?? l.channel}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded font-medium ${
                        l.status === '재케어' ? 'bg-yellow-50 text-yellow-700' :
                        ['부재케어','부재 중','부재'].includes(l.status) ? 'bg-orange-50 text-orange-700' :
                        ['성공','개통 완료','개통완료'].includes(l.status) ? 'bg-green-50 text-green-700' :
                        ['실패','취소'].includes(l.status) ? 'bg-red-50 text-red-600' :
                        'bg-gray-50 text-gray-600'
                      }`}>{l.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-400">
                      {l.last_action_at ? l.last_action_at.slice(0, 10) : '-'}
                    </td>
                    <td className="px-3 py-2.5">
                      {l.days_since_last_action === 999 ? '-' : (
                        <span className={`font-semibold ${l.days_since_last_action >= 3 ? 'text-red-500' : 'text-gray-600'}`}>
                          {l.days_since_last_action}일
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 숫자 클릭 가능한 셀 ───────────────────────────────────────
function ClickCell({
  numerator, denominator, rate, onClick, warn = false,
}: {
  numerator: number;
  denominator: number;
  rate?: number;
  onClick: () => void;
  warn?: boolean;
}) {
  return (
    <td className="px-3 py-3 text-center">
      <button
        onClick={onClick}
        className={`group flex flex-col items-center gap-0.5 mx-auto rounded-lg px-2 py-1 transition-colors hover:bg-pink-50 ${warn && numerator > 0 ? 'text-red-500' : 'text-gray-700'}`}
      >
        <span className="text-xs font-bold group-hover:text-pink-600">
          {denominator > 0 ? `${numerator}건 / ${denominator}건` : `${numerator}건`}
        </span>
        {rate !== undefined && (
          <span className={`text-[10px] font-semibold ${
            warn ? 'text-red-400' :
            rate >= 60 ? 'text-green-500' :
            rate >= 30 ? 'text-yellow-500' : 'text-gray-400'
          }`}>
            {rate}%
          </span>
        )}
        <ChevronRight className="size-3 text-gray-300 group-hover:text-pink-400" />
      </button>
    </td>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────
export default function ChannelFunnelPage() {
  const { user } = useAuth();
  const { isAdmin, isManager } = useRole();
  const canView = isAdmin || isManager;

  const [period, setPeriod] = useState<Period>('이번달');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [filterChannel, setFilterChannel] = useState<ChannelKey>('all');
  const [loading, setLoading] = useState(false);

  const [channelRows, setChannelRows] = useState<ChannelFunnelRow[]>([]);
  const [totalRow, setTotalRow] = useState<ChannelFunnelRow | null>(null);
  const [staffRows, setStaffRows] = useState<StaffFunnelRow[]>([]);

  // 드릴다운
  const [drillLeads, setDrillLeads] = useState<FunnelLeadRow[] | null>(null);
  const [drillTitle, setDrillTitle] = useState('');
  const [drillLoading, setDrillLoading] = useState(false);

  const { from, to } = buildFunnelDateRange(period, customFrom, customTo);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [cf, sf] = await Promise.all([
        getChannelFunnelData(from, to, filterChannel),
        getStaffFunnelData(from, to, filterChannel),
      ]);
      setChannelRows(cf.rows);
      setTotalRow(cf.total);
      setStaffRows(sf);
    } catch (e: any) {
      toast.error('불러오기 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [user, from, to, filterChannel]);

  useEffect(() => { load(); }, [load]);

  // 드릴다운 클릭
  const openDrill = async (
    title: string, drillType: DrillType,
    channel?: ChannelKey, staffId?: string
  ) => {
    setDrillTitle(title);
    setDrillLeads([]);
    setDrillLoading(true);
    try {
      const leads = await getFunnelDrillLeads(from, to, drillType, channel, staffId);
      setDrillLeads(leads);
    } catch (e: any) {
      toast.error('상세 조회 실패: ' + e.message);
      setDrillLeads(null);
    } finally {
      setDrillLoading(false);
    }
  };

  const diff = (n: number) => n === 0 ? '' : n > 0 ? `▲${n}` : `▼${Math.abs(n)}`;
  const diffCls = (n: number) => n > 0 ? 'text-red-500' : n < 0 ? 'text-green-500' : 'text-gray-300';

  if (!canView) {
    return (
      <div className="p-8 text-center text-sm text-gray-400">
        관리자 / 팀장만 접근할 수 있습니다.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-16">
      <WorkReportHeader
        title="채널별 퍼널 분석"
        description="부재케어·재케어 전환율과 성공률을 채널·담당자별로 실시간 확인"
      />

      {/* 필터 */}
      <div className="px-4 py-3 flex flex-wrap gap-2 items-center">
        {/* 기간 */}
        <div className="flex gap-1 flex-wrap">
          {PERIOD_OPTIONS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                period === p ? 'bg-pink-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>{p}</button>
          ))}
        </div>
        {period === '직접선택' && (
          <div className="flex gap-1 items-center">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
            <span className="text-gray-400 text-xs">~</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
          </div>
        )}
        {/* 채널 */}
        <div className="flex gap-1 ml-2">
          {(['all', ...CHANNEL_KEYS] as ChannelKey[]).map(ch => (
            <button key={ch} onClick={() => setFilterChannel(ch)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                filterChannel === ch ? 'bg-indigo-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>{CHANNEL_LABEL[ch] ?? ch}</button>
          ))}
        </div>
        <button onClick={load} disabled={loading}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {/* ── 채널별 퍼널 표 ── */}
      <div className="px-4 mb-4">
        <SectionCard title="채널별 퍼널 현황">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-100">
                  {['채널', '신규인입', '부재케어', '부재율', '재케어', '재케어율', '재케어성공', '재케어실패', '3일경과부재'].map(h => (
                    <th key={h} className="px-3 py-3 text-center font-semibold text-gray-500 text-[11px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={9} className="py-12 text-center text-sm text-gray-400">불러오는 중...</td></tr>
                ) : channelRows.length === 0 ? (
                  <tr><td colSpan={9} className="py-12 text-center text-sm text-gray-400">데이터 없음</td></tr>
                ) : (
                  <>
                    {channelRows.map(row => (
                      <tr key={row.channel} className="hover:bg-gray-50/50">
                        <td className="px-3 py-3 text-center">
                          <span className="px-2 py-1 rounded-lg bg-pink-50 text-pink-600 font-bold text-xs">
                            {CHANNEL_LABEL[row.channel] ?? row.channel}
                          </span>
                        </td>
                        {/* 신규인입 */}
                        <td className="px-3 py-3 text-center font-bold text-gray-800">{row.new_total}건</td>
                        {/* 부재케어 */}
                        <ClickCell
                          numerator={row.absent_count} denominator={row.new_total}
                          rate={row.absent_rate}
                          onClick={() => openDrill(`[${CHANNEL_LABEL[row.channel]}] 부재케어`, 'absent', row.channel as ChannelKey)}
                        />
                        {/* 부재율 */}
                        <td className="px-3 py-3 text-center">
                          <span className={`font-bold text-sm ${row.absent_rate >= 50 ? 'text-red-500' : row.absent_rate >= 30 ? 'text-orange-500' : 'text-gray-600'}`}>
                            {row.absent_rate}%
                          </span>
                        </td>
                        {/* 재케어 */}
                        <ClickCell
                          numerator={row.recare_count} denominator={row.new_total}
                          rate={row.recare_rate}
                          onClick={() => openDrill(`[${CHANNEL_LABEL[row.channel]}] 재케어`, 'recare', row.channel as ChannelKey)}
                        />
                        {/* 재케어율 */}
                        <td className="px-3 py-3 text-center">
                          <span className={`font-bold text-sm ${row.recare_rate >= 50 ? 'text-green-500' : row.recare_rate >= 20 ? 'text-yellow-500' : 'text-gray-500'}`}>
                            {row.recare_rate}%
                          </span>
                        </td>
                        {/* 재케어 성공 */}
                        <ClickCell
                          numerator={row.recare_success_count} denominator={row.recare_count}
                          rate={row.recare_success_rate}
                          onClick={() => openDrill(`[${CHANNEL_LABEL[row.channel]}] 재케어→성공`, 'recare_success', row.channel as ChannelKey)}
                        />
                        {/* 재케어 실패 */}
                        <ClickCell
                          numerator={row.recare_fail_count} denominator={row.recare_count}
                          rate={row.recare_fail_rate} warn
                          onClick={() => openDrill(`[${CHANNEL_LABEL[row.channel]}] 재케어→실패`, 'recare_fail', row.channel as ChannelKey)}
                        />
                        {/* 3일 경과 부재 */}
                        <ClickCell
                          numerator={row.absent_expired} denominator={row.absent_count}
                          onClick={() => openDrill(`[${CHANNEL_LABEL[row.channel]}] 3일경과 부재케어`, 'absent_expired', row.channel as ChannelKey)}
                          warn={row.absent_expired > 0}
                        />
                      </tr>
                    ))}
                    {/* 전체 합계 */}
                    {totalRow && (
                      <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                        <td className="px-3 py-3 text-center text-xs font-bold text-gray-700">전체</td>
                        <td className="px-3 py-3 text-center font-bold text-gray-800">{totalRow.new_total}건</td>
                        <ClickCell
                          numerator={totalRow.absent_count} denominator={totalRow.new_total}
                          rate={totalRow.absent_rate}
                          onClick={() => openDrill('전체 부재케어', 'absent', 'all')}
                        />
                        <td className="px-3 py-3 text-center">
                          <span className={`font-bold text-sm ${totalRow.absent_rate >= 50 ? 'text-red-500' : 'text-gray-600'}`}>
                            {totalRow.absent_rate}%
                          </span>
                        </td>
                        <ClickCell
                          numerator={totalRow.recare_count} denominator={totalRow.new_total}
                          rate={totalRow.recare_rate}
                          onClick={() => openDrill('전체 재케어', 'recare', 'all')}
                        />
                        <td className="px-3 py-3 text-center">
                          <span className={`font-bold text-sm ${totalRow.recare_rate >= 50 ? 'text-green-500' : 'text-gray-500'}`}>
                            {totalRow.recare_rate}%
                          </span>
                        </td>
                        <ClickCell
                          numerator={totalRow.recare_success_count} denominator={totalRow.recare_count}
                          rate={totalRow.recare_success_rate}
                          onClick={() => openDrill('전체 재케어→성공', 'recare_success', 'all')}
                        />
                        <ClickCell
                          numerator={totalRow.recare_fail_count} denominator={totalRow.recare_count}
                          rate={totalRow.recare_fail_rate} warn
                          onClick={() => openDrill('전체 재케어→실패', 'recare_fail', 'all')}
                        />
                        <ClickCell
                          numerator={totalRow.absent_expired} denominator={totalRow.absent_count}
                          onClick={() => openDrill('전체 3일경과 부재케어', 'absent_expired', 'all')}
                          warn={totalRow.absent_expired > 0}
                        />
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 px-1 text-[10px] text-gray-400">
            * 재케어→성공/실패 전환 건수는 previous_status 기록 시점부터 집계됩니다.
            &nbsp;* 3일경과 부재케어는 통계에서만 실패 처리 (실제 상태 변경 없음).
          </p>
        </SectionCard>
      </div>

      {/* ── 담당자별 채널 집중도 ── */}
      <div className="px-4 mb-4">
        <SectionCard title="담당자별 현황 (전일 대비 포함)">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-100">
                  {['담당자', '주력채널', '채널 집중', '부재케어', '전일대비', '재케어', '전일대비', '재케어성공', '재케어실패'].map(h => (
                    <th key={h} className="px-3 py-3 text-center font-semibold text-gray-500 text-[11px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={9} className="py-12 text-center text-sm text-gray-400">불러오는 중...</td></tr>
                ) : staffRows.length === 0 ? (
                  <tr><td colSpan={9} className="py-12 text-center text-sm text-gray-400">데이터 없음</td></tr>
                ) : staffRows.map(row => (
                  <tr key={row.staff_name} className="hover:bg-gray-50/50">
                    <td className="px-3 py-3 font-semibold text-gray-900">{row.staff_name}</td>
                    {/* 주력채널 */}
                    <td className="px-3 py-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium text-[11px]">
                        {CHANNEL_LABEL[row.main_channel] ?? row.main_channel}
                      </span>
                    </td>
                    {/* 채널 집중도 */}
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {Object.entries(row.channels)
                          .sort((a, b) => b[1] - a[1])
                          .map(([ch, cnt]) => (
                            <button key={ch}
                              onClick={() => openDrill(`[${row.staff_name}] ${CHANNEL_LABEL[ch] ?? ch} 전체`, 'absent', ch as ChannelKey, row.staff_id ?? undefined)}
                              className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] hover:bg-pink-50 hover:text-pink-600 transition-colors">
                              {CHANNEL_LABEL[ch] ?? ch} {cnt}
                            </button>
                          ))}
                      </div>
                    </td>
                    {/* 부재케어 */}
                    <ClickCell
                      numerator={row.absent_count} denominator={0}
                      onClick={() => openDrill(`[${row.staff_name}] 부재케어`, 'absent', filterChannel, row.staff_id ?? undefined)}
                    />
                    {/* 전일대비 부재 */}
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs font-bold ${diffCls(row.absent_diff)}`}>
                        {diff(row.absent_diff) || '-'}
                      </span>
                    </td>
                    {/* 재케어 */}
                    <ClickCell
                      numerator={row.recare_count} denominator={0}
                      onClick={() => openDrill(`[${row.staff_name}] 재케어`, 'recare', filterChannel, row.staff_id ?? undefined)}
                    />
                    {/* 전일대비 재케어 */}
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs font-bold ${diffCls(row.recare_diff)}`}>
                        {diff(row.recare_diff) || '-'}
                      </span>
                    </td>
                    {/* 재케어 성공 */}
                    <ClickCell
                      numerator={row.recare_success_count} denominator={row.recare_count}
                      rate={row.recare_success_rate}
                      onClick={() => openDrill(`[${row.staff_name}] 재케어→성공`, 'recare_success', filterChannel, row.staff_id ?? undefined)}
                    />
                    {/* 재케어 실패 */}
                    <ClickCell
                      numerator={row.recare_fail_count} denominator={row.recare_count}
                      rate={row.recare_fail_rate} warn
                      onClick={() => openDrill(`[${row.staff_name}] 재케어→실패`, 'recare_fail', filterChannel, row.staff_id ?? undefined)}
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      {/* ── 3일 경과 부재케어 경고 ── */}
      {totalRow && totalRow.absent_expired > 0 && (
        <div className="px-4 mb-4">
          <SectionCard title={`⚠️ 3일 경과 부재케어 ${totalRow.absent_expired}건 — 즉시 확인 필요`}>
            <button
              onClick={() => openDrill('3일경과 부재케어 전체', 'absent_expired', filterChannel)}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors w-full"
            >
              <AlertTriangle className="size-4" />
              {totalRow.absent_expired}건 목록 확인하기
              <ChevronRight className="size-4 ml-auto" />
            </button>
          </SectionCard>
        </div>
      )}

      {/* 드릴다운 모달 */}
      {(drillLeads !== null || drillLoading) && (
        <DrillModal
          title={drillLoading ? '불러오는 중...' : drillTitle}
          leads={drillLeads ?? []}
          onClose={() => { setDrillLeads(null); setDrillTitle(''); }}
        />
      )}
    </div>
  );
}
