// ============================================================
// 채널별 퍼널 분석 — 3탭 구조
// 탭1: 퍼널 현황 / 탭2: 실패 사유 분석 / 탭3: 심층 분석
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronRight, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { WorkReportHeader, SectionCard } from './_shared';
import {
  getChannelFunnelData, getStaffFunnelData, getFunnelDrillLeads,
  getFailReasonStats, getAbsentCountAnalysis, getHourlyAbsentStats,
  buildFunnelDateRange,
  CHANNEL_LABEL, CHANNEL_KEYS, FAIL_REASON_LABELS,
  type ChannelFunnelRow, type StaffFunnelRow, type FunnelLeadRow,
  type DrillType, type ChannelKey,
  type AbsentCountRow, type HourlyAbsentRow,
} from '@/services/workReport/channelFunnelService';

const PERIOD_OPTIONS = ['오늘', '전일', '이번주', '이번달', '전체', '직접선택'] as const;
type Period = typeof PERIOD_OPTIONS[number];
type MainTab = 'funnel' | 'fail_reason' | 'deep';

const CHANNEL_COLORS: Record<string, string> = {
  meta: 'bg-pink-100 text-pink-700',
  dogmaru: 'bg-blue-100 text-blue-700',
  udak: 'bg-purple-100 text-purple-700',
  allinone: 'bg-green-100 text-green-700',
  other: 'bg-gray-100 text-gray-600',
};

// ── 드릴다운 모달 ─────────────────────────────────────────────
function DrillModal({ title, leads, onClose }: { title: string; leads: FunnelLeadRow[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="text-base font-bold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-400 mt-0.5">총 {leads.length}건</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="size-4 text-gray-500" /></button>
        </div>
        <div className="overflow-y-auto flex-1">
          {leads.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">해당 건이 없습니다</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 border-b">
                <tr>{['고객명', '연락처', '담당자', '채널', '현재상태', '마지막액션', '경과일'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leads.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50/50">
                    <td className="px-3 py-2.5 font-medium text-gray-900">{l.customer_name}</td>
                    <td className="px-3 py-2.5 text-gray-500">{l.customer_phone ?? '-'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{l.assigned_name}</td>
                    <td className="px-3 py-2.5"><span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${CHANNEL_COLORS[l.channel] ?? 'bg-gray-100 text-gray-600'}`}>{CHANNEL_LABEL[l.channel] ?? l.channel}</span></td>
                    <td className="px-3 py-2.5"><span className={`px-1.5 py-0.5 rounded font-medium text-[11px] ${['부재케어','부재 중','부재'].includes(l.status) ? 'bg-orange-50 text-orange-700' : l.status === '재케어' ? 'bg-yellow-50 text-yellow-700' : ['성공','개통 완료','개통완료'].includes(l.status) ? 'bg-green-50 text-green-700' : ['실패','취소'].includes(l.status) ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-600'}`}>{l.status}</span></td>
                    <td className="px-3 py-2.5 text-gray-400">{l.last_action_at ? l.last_action_at.slice(0, 10) : '-'}</td>
                    <td className="px-3 py-2.5"><span className={`font-semibold ${l.days_since_last_action >= 3 ? 'text-red-500' : 'text-gray-600'}`}>{l.days_since_last_action === 999 ? '-' : `${l.days_since_last_action}일`}</span></td>
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

// ── 클릭 가능한 숫자 셀 ───────────────────────────────────────
function ClickCell({ numerator, denominator, rate, onClick, warn = false }: { numerator: number; denominator: number; rate?: number; onClick: () => void; warn?: boolean }) {
  return (
    <td className="px-3 py-3 text-center">
      <button onClick={onClick} className={`group flex flex-col items-center gap-0.5 mx-auto rounded-lg px-2 py-1 transition-colors hover:bg-pink-50 ${warn && numerator > 0 ? 'text-red-500' : 'text-gray-700'}`}>
        <span className="text-xs font-bold group-hover:text-pink-600">{denominator > 0 ? `${numerator}건 / ${denominator}건` : `${numerator}건`}</span>
        {rate !== undefined && <span className={`text-[10px] font-semibold ${warn ? 'text-red-400' : rate >= 60 ? 'text-green-500' : rate >= 30 ? 'text-yellow-500' : 'text-gray-400'}`}>{rate}%</span>}
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
  const [mainTab, setMainTab] = useState<MainTab>('funnel');
  const [loading, setLoading] = useState(false);

  // 탭1 데이터
  const [channelRows, setChannelRows] = useState<ChannelFunnelRow[]>([]);
  const [totalRow, setTotalRow] = useState<ChannelFunnelRow | null>(null);
  const [staffRows, setStaffRows] = useState<StaffFunnelRow[]>([]);

  // 탭2 데이터
  const [failReasonData, setFailReasonData] = useState<{ byReason: Record<string, Record<string, number>>; total: Record<string, number> } | null>(null);

  // 탭3 데이터
  const [absentCountData, setAbsentCountData] = useState<AbsentCountRow[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyAbsentRow[]>([]);

  // 드릴다운
  const [drillLeads, setDrillLeads] = useState<FunnelLeadRow[] | null>(null);
  const [drillTitle, setDrillTitle] = useState('');
  const [drillLoading, setDrillLoading] = useState(false);

  const { from, to } = buildFunnelDateRange(period, customFrom, customTo);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [cf, sf, fr, ac, hd] = await Promise.all([
        getChannelFunnelData(from, to, filterChannel),
        getStaffFunnelData(from, to, filterChannel),
        getFailReasonStats(from, to, filterChannel),
        getAbsentCountAnalysis(from, to, filterChannel),
        getHourlyAbsentStats(from, to, filterChannel),
      ]);
      setChannelRows(cf.rows);
      setTotalRow(cf.total);
      setStaffRows(sf);
      setFailReasonData(fr);
      setAbsentCountData(ac);
      setHourlyData(hd);
    } catch (e: any) {
      toast.error('불러오기 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [user, from, to, filterChannel]);

  useEffect(() => { load(); }, [load]);

  const openDrill = async (title: string, drillType: DrillType, channel?: ChannelKey, staffId?: string) => {
    setDrillTitle(title); setDrillLeads([]); setDrillLoading(true);
    try {
      const leads = await getFunnelDrillLeads(from, to, drillType, channel, staffId);
      setDrillLeads(leads);
    } catch (e: any) {
      toast.error('상세 조회 실패: ' + e.message); setDrillLeads(null);
    } finally { setDrillLoading(false); }
  };

  const diff = (n: number) => n === 0 ? '' : n > 0 ? `▲${n}` : `▼${Math.abs(n)}`;
  const diffCls = (n: number) => n > 0 ? 'text-red-500' : n < 0 ? 'text-green-500' : 'text-gray-300';

  if (!canView) return <div className="p-8 text-center text-sm text-gray-400">관리자 / 팀장만 접근할 수 있습니다.</div>;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-16">
      <WorkReportHeader title="채널별 퍼널 분석" description="부재케어·재케어 전환율, 실패 사유, 시간대별 패턴을 채널·담당자별로 실시간 확인" />

      {/* 공통 필터 */}
      <div className="px-4 py-3 flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 flex-wrap">
          {PERIOD_OPTIONS.map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${period === p ? 'bg-pink-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{p}</button>
          ))}
        </div>
        {period === '직접선택' && (
          <div className="flex gap-1 items-center">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
            <span className="text-gray-400 text-xs">~</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
          </div>
        )}
        <div className="flex gap-1 ml-2">
          {(['all', ...CHANNEL_KEYS] as ChannelKey[]).map(ch => (
            <button key={ch} onClick={() => setFilterChannel(ch)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${filterChannel === ch ? 'bg-indigo-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{CHANNEL_LABEL[ch] ?? ch}</button>
          ))}
        </div>
        <button onClick={load} disabled={loading} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />새로고침
        </button>
      </div>

      {/* 메인 탭 */}
      <div className="px-4 mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {([['funnel', '📊 퍼널 현황'], ['fail_reason', '❌ 실패 사유'], ['deep', '🔬 심층 분석']] as [MainTab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setMainTab(key)} className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${mainTab === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>{label}</button>
          ))}
        </div>
      </div>

      {/* ═══ 탭1: 퍼널 현황 ═══ */}
      {mainTab === 'funnel' && (
        <>
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
                    {loading ? <tr><td colSpan={9} className="py-12 text-center text-sm text-gray-400">불러오는 중...</td></tr>
                      : channelRows.length === 0 ? <tr><td colSpan={9} className="py-12 text-center text-sm text-gray-400">데이터 없음</td></tr>
                      : <>
                        {channelRows.map(row => (
                          <tr key={row.channel} className="hover:bg-gray-50/50">
                            <td className="px-3 py-3 text-center"><span className={`px-2 py-1 rounded-lg font-bold text-xs ${CHANNEL_COLORS[row.channel] ?? 'bg-gray-100 text-gray-600'}`}>{CHANNEL_LABEL[row.channel] ?? row.channel}</span></td>
                            <td className="px-3 py-3 text-center font-bold text-gray-800">{row.new_total}건</td>
                            <ClickCell numerator={row.absent_count} denominator={row.new_total} rate={row.absent_rate} onClick={() => openDrill(`[${CHANNEL_LABEL[row.channel]}] 부재케어`, 'absent', row.channel as ChannelKey)} />
                            <td className="px-3 py-3 text-center"><span className={`font-bold text-sm ${row.absent_rate >= 50 ? 'text-red-500' : row.absent_rate >= 30 ? 'text-orange-500' : 'text-gray-600'}`}>{row.absent_rate}%</span></td>
                            <ClickCell numerator={row.recare_count} denominator={row.new_total} rate={row.recare_rate} onClick={() => openDrill(`[${CHANNEL_LABEL[row.channel]}] 재케어`, 'recare', row.channel as ChannelKey)} />
                            <td className="px-3 py-3 text-center"><span className={`font-bold text-sm ${row.recare_rate >= 50 ? 'text-green-500' : row.recare_rate >= 20 ? 'text-yellow-500' : 'text-gray-500'}`}>{row.recare_rate}%</span></td>
                            <ClickCell numerator={row.recare_success_count} denominator={row.recare_count} rate={row.recare_success_rate} onClick={() => openDrill(`[${CHANNEL_LABEL[row.channel]}] 재케어→성공`, 'recare_success', row.channel as ChannelKey)} />
                            <ClickCell numerator={row.recare_fail_count} denominator={row.recare_count} rate={row.recare_fail_rate} warn onClick={() => openDrill(`[${CHANNEL_LABEL[row.channel]}] 재케어→실패`, 'recare_fail', row.channel as ChannelKey)} />
                            <ClickCell numerator={row.absent_expired} denominator={row.absent_count} onClick={() => openDrill(`[${CHANNEL_LABEL[row.channel]}] 3일경과 부재케어`, 'absent_expired', row.channel as ChannelKey)} warn={row.absent_expired > 0} />
                          </tr>
                        ))}
                        {totalRow && (
                          <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                            <td className="px-3 py-3 text-center text-xs font-bold text-gray-700">전체</td>
                            <td className="px-3 py-3 text-center font-bold text-gray-800">{totalRow.new_total}건</td>
                            <ClickCell numerator={totalRow.absent_count} denominator={totalRow.new_total} rate={totalRow.absent_rate} onClick={() => openDrill('전체 부재케어', 'absent', 'all')} />
                            <td className="px-3 py-3 text-center"><span className={`font-bold text-sm ${totalRow.absent_rate >= 50 ? 'text-red-500' : 'text-gray-600'}`}>{totalRow.absent_rate}%</span></td>
                            <ClickCell numerator={totalRow.recare_count} denominator={totalRow.new_total} rate={totalRow.recare_rate} onClick={() => openDrill('전체 재케어', 'recare', 'all')} />
                            <td className="px-3 py-3 text-center"><span className={`font-bold text-sm ${totalRow.recare_rate >= 50 ? 'text-green-500' : 'text-gray-500'}`}>{totalRow.recare_rate}%</span></td>
                            <ClickCell numerator={totalRow.recare_success_count} denominator={totalRow.recare_count} rate={totalRow.recare_success_rate} onClick={() => openDrill('전체 재케어→성공', 'recare_success', 'all')} />
                            <ClickCell numerator={totalRow.recare_fail_count} denominator={totalRow.recare_count} rate={totalRow.recare_fail_rate} warn onClick={() => openDrill('전체 재케어→실패', 'recare_fail', 'all')} />
                            <ClickCell numerator={totalRow.absent_expired} denominator={totalRow.absent_count} onClick={() => openDrill('전체 3일경과 부재케어', 'absent_expired', 'all')} warn={totalRow.absent_expired > 0} />
                          </tr>
                        )}
                      </>
                    }
                  </tbody>
                </table>
              </div>
              <p className="mt-2 px-1 text-[10px] text-gray-400">* 재케어→성공/실패는 previous_status 기록 시점부터 집계 &nbsp;* 3일경과 부재케어는 통계에서만 실패 처리</p>
            </SectionCard>
          </div>

          {/* 담당자별 현황 */}
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
                    {loading ? <tr><td colSpan={9} className="py-12 text-center text-sm text-gray-400">불러오는 중...</td></tr>
                      : staffRows.length === 0 ? <tr><td colSpan={9} className="py-12 text-center text-sm text-gray-400">데이터 없음</td></tr>
                      : staffRows.map(row => (
                        <tr key={row.staff_name} className="hover:bg-gray-50/50">
                          <td className="px-3 py-3 font-semibold text-gray-900">{row.staff_name}</td>
                          <td className="px-3 py-3 text-center"><span className={`px-2 py-0.5 rounded text-[11px] font-medium ${CHANNEL_COLORS[row.main_channel] ?? 'bg-gray-100 text-gray-500'}`}>{CHANNEL_LABEL[row.main_channel] ?? row.main_channel}</span></td>
                          <td className="px-3 py-3"><div className="flex flex-wrap gap-1 justify-center">{Object.entries(row.channels).sort((a,b)=>b[1]-a[1]).map(([ch,cnt])=>(<button key={ch} onClick={()=>openDrill(`[${row.staff_name}] ${CHANNEL_LABEL[ch]??ch}`, 'absent', ch as ChannelKey, row.staff_id??undefined)} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] hover:bg-pink-50 hover:text-pink-600">{CHANNEL_LABEL[ch]??ch} {cnt}</button>))}</div></td>
                          <ClickCell numerator={row.absent_count} denominator={0} onClick={()=>openDrill(`[${row.staff_name}] 부재케어`, 'absent', filterChannel, row.staff_id??undefined)} />
                          <td className="px-3 py-3 text-center"><span className={`text-xs font-bold ${diffCls(row.absent_diff)}`}>{diff(row.absent_diff)||'-'}</span></td>
                          <ClickCell numerator={row.recare_count} denominator={0} onClick={()=>openDrill(`[${row.staff_name}] 재케어`, 'recare', filterChannel, row.staff_id??undefined)} />
                          <td className="px-3 py-3 text-center"><span className={`text-xs font-bold ${diffCls(row.recare_diff)}`}>{diff(row.recare_diff)||'-'}</span></td>
                          <ClickCell numerator={row.recare_success_count} denominator={row.recare_count} rate={row.recare_success_rate} onClick={()=>openDrill(`[${row.staff_name}] 재케어→성공`, 'recare_success', filterChannel, row.staff_id??undefined)} />
                          <ClickCell numerator={row.recare_fail_count} denominator={row.recare_count} rate={row.recare_fail_rate} warn onClick={()=>openDrill(`[${row.staff_name}] 재케어→실패`, 'recare_fail', filterChannel, row.staff_id??undefined)} />
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

          {totalRow && totalRow.absent_expired > 0 && (
            <div className="px-4 mb-4">
              <SectionCard title={`⚠️ 3일 경과 부재케어 ${totalRow.absent_expired}건 — 즉시 확인 필요`}>
                <button onClick={()=>openDrill('3일경과 부재케어', 'absent_expired', filterChannel)} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-semibold hover:bg-red-100 w-full">
                  <AlertTriangle className="size-4" />{totalRow.absent_expired}건 목록 확인<ChevronRight className="size-4 ml-auto" />
                </button>
              </SectionCard>
            </div>
          )}
        </>
      )}

      {/* ═══ 탭2: 실패 사유 분석 ═══ */}
      {mainTab === 'fail_reason' && (
        <div className="px-4 mb-4 space-y-4">
          <SectionCard title="실패 사유별 채널 분포">
            {loading ? <div className="py-12 text-center text-sm text-gray-400">불러오는 중...</div>
              : !failReasonData || Object.keys(failReasonData.total).length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-gray-400 mb-2">아직 분류된 실패 사유가 없습니다</p>
                  <p className="text-xs text-gray-300">실패 처리 시 사유를 선택하면 여기에 집계됩니다</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[600px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-3 py-3 text-left font-semibold text-gray-500">실패 사유</th>
                        {CHANNEL_KEYS.map(ch => <th key={ch} className="px-3 py-3 text-center font-semibold text-gray-500">{CHANNEL_LABEL[ch]}</th>)}
                        <th className="px-3 py-3 text-center font-semibold text-gray-700">전체</th>
                        <th className="px-3 py-3 text-center font-semibold text-gray-500">비율</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {Object.entries(failReasonData.total)
                        .sort((a, b) => b[1] - a[1])
                        .map(([reason, total]) => {
                          const grandTotal = Object.values(failReasonData.total).reduce((a,b)=>a+b,0);
                          const rate = grandTotal > 0 ? Math.round(total/grandTotal*100) : 0;
                          return (
                            <tr key={reason} className="hover:bg-gray-50/50">
                              <td className="px-3 py-3 font-medium text-gray-800">{reason}</td>
                              {CHANNEL_KEYS.map(ch => {
                                const cnt = failReasonData.byReason[reason]?.[ch] ?? 0;
                                return <td key={ch} className="px-3 py-3 text-center">
                                  {cnt > 0 ? <span className={`px-2 py-0.5 rounded font-bold text-xs ${CHANNEL_COLORS[ch]}`}>{cnt}건</span> : <span className="text-gray-300">-</span>}
                                </td>;
                              })}
                              <td className="px-3 py-3 text-center font-bold text-gray-900">{total}건</td>
                              <td className="px-3 py-3 text-center">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-400 rounded-full" style={{width:`${rate}%`}} />
                                  </div>
                                  <span className="text-xs font-semibold text-red-500 w-8">{rate}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            <p className="mt-3 text-[10px] text-gray-400 px-1">* 실패 처리 시 선택한 사유 기준으로 집계됩니다. 메모의 [실패:사유] 패턴도 자동 파싱됩니다.</p>
          </SectionCard>

          {/* 채널별 실패 사유 TOP3 */}
          {failReasonData && Object.keys(failReasonData.total).length > 0 && (
            <SectionCard title="채널별 실패 사유 TOP 3">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {CHANNEL_KEYS.map(ch => {
                  const chReasons = Object.entries(failReasonData.byReason)
                    .map(([reason, byChannel]) => ({ reason, count: byChannel[ch] ?? 0 }))
                    .filter(r => r.count > 0)
                    .sort((a,b) => b.count - a.count)
                    .slice(0, 3);
                  return (
                    <div key={ch} className="bg-white rounded-xl border border-gray-100 p-3">
                      <div className={`text-xs font-bold mb-2 px-2 py-0.5 rounded w-fit ${CHANNEL_COLORS[ch]}`}>{CHANNEL_LABEL[ch]}</div>
                      {chReasons.length === 0 ? <p className="text-xs text-gray-300">데이터 없음</p>
                        : chReasons.map((r, i) => (
                          <div key={r.reason} className="flex items-center gap-2 py-1">
                            <span className={`text-xs font-bold w-4 ${i===0?'text-red-500':i===1?'text-orange-400':'text-yellow-500'}`}>{i+1}</span>
                            <span className="text-xs text-gray-700 flex-1 truncate">{r.reason}</span>
                            <span className="text-xs font-semibold text-gray-500">{r.count}건</span>
                          </div>
                        ))}
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ═══ 탭3: 심층 분석 ═══ */}
      {mainTab === 'deep' && (
        <div className="px-4 mb-4 space-y-4">
          {/* 부재 횟수별 최종 결과 */}
          <SectionCard title="부재 횟수별 최종 결과">
            {loading ? <div className="py-8 text-center text-sm text-gray-400">불러오는 중...</div>
              : absentCountData.length === 0 ? <div className="py-8 text-center text-sm text-gray-400">데이터 없음</div>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['부재 횟수', '전체', '현재 성공', '현재 실패', '아직 부재중', '재케어', '성공률', '실패율'].map(h => (
                          <th key={h} className="px-3 py-3 text-center font-semibold text-gray-500 text-[11px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {absentCountData.map(row => (
                        <tr key={row.absent_count} className="hover:bg-gray-50/50">
                          <td className="px-3 py-3 text-center">
                            <span className={`px-2 py-1 rounded-lg font-bold text-xs ${row.absent_count >= 5 ? 'bg-red-100 text-red-700' : row.absent_count >= 3 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-50 text-yellow-700'}`}>
                              {row.absent_count}회
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center font-bold text-gray-700">{row.total}건</td>
                          <td className="px-3 py-3 text-center text-green-600 font-semibold">{row.success}건</td>
                          <td className="px-3 py-3 text-center text-red-500 font-semibold">{row.fail}건</td>
                          <td className="px-3 py-3 text-center text-orange-500">{row.still_absent}건</td>
                          <td className="px-3 py-3 text-center text-yellow-600">{row.recare}건</td>
                          <td className="px-3 py-3 text-center">
                            <span className={`font-bold text-sm ${row.success_rate >= 20 ? 'text-green-600' : row.success_rate >= 10 ? 'text-yellow-600' : 'text-gray-400'}`}>{row.success_rate}%</span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`font-bold text-sm ${row.fail_rate >= 50 ? 'text-red-500' : 'text-gray-500'}`}>{row.fail_rate}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 px-1 text-[10px] text-gray-400">* 부재/N회 메모 기준 집계. "아직 부재중"은 최종 처리가 안 된 건수.</p>
                </div>
              )}
          </SectionCard>

          {/* 시간대별 부재율 */}
          <SectionCard title="시간대별 부재율">
            {loading ? <div className="py-8 text-center text-sm text-gray-400">불러오는 중...</div>
              : hourlyData.filter(r => r.attempt + r.absent > 0).length === 0
              ? <div className="py-8 text-center text-sm text-gray-400">데이터 없음 (통화시도/부재 로그가 필요합니다)</div>
              : (
                <div className="space-y-2">
                  {hourlyData.filter(r => r.attempt + r.absent > 0).map(row => {
                    const total = row.attempt + row.absent;
                    const absentRate = total > 0 ? Math.round(row.absent / total * 100) : 0;
                    return (
                      <div key={row.hour} className="flex items-center gap-3">
                        <span className="text-xs font-mono text-gray-500 w-12 text-right">{row.hour}시</span>
                        <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden relative">
                          <div className="h-full bg-orange-400 rounded-lg transition-all" style={{width:`${absentRate}%`}} />
                          <span className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold text-gray-700">
                            시도 {total}건 · 부재 {row.absent}건
                          </span>
                        </div>
                        <span className={`text-xs font-bold w-10 ${absentRate >= 70 ? 'text-red-500' : absentRate >= 40 ? 'text-orange-500' : 'text-gray-500'}`}>{absentRate}%</span>
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-gray-400 mt-2">* 활동 로그 기준. 부재율 = 부재 ÷ (시도+부재)</p>
                </div>
              )}
          </SectionCard>
        </div>
      )}

      {/* 드릴다운 모달 */}
      {(drillLeads !== null || drillLoading) && (
        <DrillModal title={drillLoading ? '불러오는 중...' : drillTitle} leads={drillLeads ?? []} onClose={() => { setDrillLeads(null); setDrillTitle(''); }} />
      )}
    </div>
  );
}
ENDTSX
echo "페이지 생성 완료, $(wc -l < /tmp/ChannelFunnelPage_new.tsx)라인"