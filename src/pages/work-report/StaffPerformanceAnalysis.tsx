// ============================================================
// 직원 성과 분석 — 관리자/팀장 전용 대시보드
// leads(신규) / activity_logs(업무량) / sales(개통·정산) 분리
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { WorkReportHeader, SectionCard, WRBadge } from './_shared';
import { LogDetailModal, type LogDetailFilter } from './LogDetailModal';
import {
  buildDateRange, getKpiSummary, getStaffWorkSummary, getStaffDailyTrend,
  getChannelPerformance, getWarningAlerts,
  getStaffSalesSummary, getStaffChannelSalesStats, getStaffProductDetailStats,
  getStaffChannelFocusStats, getChannelFunnelStats, getDeviceFilterOptions,
  type KpiSummary, type StaffWorkRow, type DailyTrendRow,
  type ChannelPerformanceRow, type WarningAlert,
  type StaffSalesSummaryRow, type StaffChannelSalesRow, type ProductDeviceRow,
  type StaffChannelFocusRow, type ChannelFunnelRow,
} from '@/services/workReport/staffPerformanceService';

type Period = '오늘' | '어제' | '이번주' | '이번달' | '전체기간' | '직접선택';
type TabKey = 'overview' | 'staff' | 'trend' | 'channel' | 'alerts' | 'sales_summary' | 'product_detail' | 'funnel';

const CHANNEL_LABEL: Record<string, string> = {
  meta: '메타', dogmaru: '도그마루', udak: '유닥', moyo: '모요', other: '기타인입', '기타': '기타',
};

const KPI_CONFIG = [
  { key: 'new_leads', label: '신규접수', color: 'text-blue-600', source: 'leads' as const },
  { key: 'pending_leads', label: '미처리신규', color: 'text-red-500', source: 'leads' as const },
  { key: 'call_attempt', label: '통화시도', color: 'text-gray-700', source: 'activity' as const, actions: ['call_attempt'] },
  { key: 'call_connected', label: '연결완료', color: 'text-indigo-600', source: 'activity' as const, actions: ['call_connected'] },
  { key: 'absent', label: '부재', color: 'text-orange-500', source: 'activity' as const, actions: ['absent'] },
  { key: 'recare', label: '재케어', color: 'text-yellow-600', source: 'activity' as const, actions: ['recare_registered','recare_completed'] },
  { key: 'failed', label: '실패', color: 'text-red-500', source: 'activity' as const, actions: ['failed'] },
  { key: 'consultation_success', label: '상담성공', color: 'text-green-600', source: 'activity' as const, actions: ['consultation_success'] },
  { key: 'activation_completed', label: '개통완료', color: 'text-pink-600', source: 'sales' as const },
];

export default function StaffPerformanceAnalysis() {
  const { user } = useAuth();
  const { isAdmin, isManager, loading: roleLoading } = useRole();
  const canView = isAdmin || isManager;

  const [period, setPeriod] = useState<Period>('오늘');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selChannel, setSelChannel] = useState('');
  const [selStaff, setSelStaff] = useState('');
  const [selProduct, setSelProduct] = useState('');
  const [selCounted, setSelCounted] = useState('');
  const [tab, setTab] = useState<TabKey>('overview');

  const [kpi, setKpi] = useState<KpiSummary | null>(null);
  const [staffRows, setStaffRows] = useState<StaffWorkRow[]>([]);
  const [trend, setTrend] = useState<DailyTrendRow[]>([]);
  const [channels, setChannels] = useState<ChannelPerformanceRow[]>([]);
  const [alerts, setAlerts] = useState<WarningAlert[]>([]);
  const [salesSummary, setSalesSummary] = useState<StaffSalesSummaryRow[]>([]);
  const [productDetail, setProductDetail] = useState<ProductDeviceRow[]>([]);
  const [channelFocus, setChannelFocus] = useState<StaffChannelFocusRow[]>([]);
  const [channelSales, setChannelSales] = useState<StaffChannelSalesRow[]>([]);
  const [deviceOptions, setDeviceOptions] = useState<{ devices: string[]; plans: string[]; saleTypes: string[] }>({ devices: [], plans: [], saleTypes: [] });
  const [selDevice, setSelDevice] = useState('');
  const [selPlan, setSelPlan] = useState('');
  const [selSaleType, setSelSaleType] = useState('');
  const [funnelRows, setFunnelRows] = useState<ChannelFunnelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailFilter, setDetailFilter] = useState<LogDetailFilter | null>(null);

  const { from, to } = buildDateRange(period, customFrom, customTo);

  const load = useCallback(async () => {
    if (!user || roleLoading) return;
    setLoading(true);
    try {
      const filters = {
        staffId: selStaff || undefined,
        channel: selChannel || undefined,
        product: selProduct || undefined,
        isCounted: selCounted === 'true' ? true : selCounted === 'false' ? false : undefined,
      };
      const [k, s, t, c, a, ss, cs, pd, fn, cf, dopt] = await Promise.all([
        getKpiSummary(from, to, filters),
        getStaffWorkSummary(from, to, filters),
        getStaffDailyTrend(from, to, filters),
        getChannelPerformance(from, to, filters),
        getWarningAlerts(),
        getStaffSalesSummary(from, to, selStaff || undefined),
        getStaffChannelSalesStats(from, to, selStaff || undefined),
        getStaffProductDetailStats(from, to, selStaff || undefined, selChannel || undefined, selDevice || undefined, selPlan || undefined, selSaleType || undefined),
        getChannelFunnelStats(from, to),
        getStaffChannelFocusStats(from, to, selStaff || undefined),
        getDeviceFilterOptions(from, to),
      ]);
      setKpi(k); setStaffRows(s); setTrend(t); setChannels(c); setAlerts(a);
      setSalesSummary(ss); setChannelSales(cs); setProductDetail(pd); setFunnelRows(fn); setChannelFocus(cf); setDeviceOptions(dopt);
    } catch (e: any) {
      toast.error('조회 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [user, roleLoading, from, to, selStaff, selChannel, selProduct, selCounted, selDevice, selPlan, selSaleType]);

  useEffect(() => { if (!roleLoading) load(); }, [roleLoading, load]);

  const openDetail = (f: LogDetailFilter) => setDetailFilter(f);

  // 권한 체크
  if (!roleLoading && !canView) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center text-gray-400">
          <div className="text-lg font-semibold mb-1">접근 권한 없음</div>
          <div className="text-sm">관리자/팀장만 접근할 수 있습니다.</div>
        </div>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: '전체 대시보드' },
    { key: 'staff', label: '직원별 업무량' },
    { key: 'sales_summary', label: '직원별 판매요약' },
    { key: 'product_detail', label: '상품·기기 분석' },
    { key: 'funnel', label: '채널 퍼널' },
    { key: 'trend', label: '일별 추이' },
    { key: 'channel', label: '채널별 성과' },
    { key: 'alerts', label: `이상 알림 ${alerts.length > 0 ? `(${alerts.length})` : ''}` },
  ];
  const CHANNEL_LABELS: Record<string, string> = { meta: '메타', dogmaru: '도그마루', udak: '유닥', moyo: '모요', other: '기타인입', '기타': '기타' };
  const pct = (a: number, b: number) => b > 0 ? `${Math.round(a / b * 100)}%` : '-';

  return (
    <div className="space-y-4">
      {detailFilter && <LogDetailModal filter={detailFilter} onClose={() => setDetailFilter(null)} onDone={load} />}

      <WorkReportHeader
        title="직원 성과 분석"
        description="관리자용 직원 업무량·성과·채널 분석 대시보드"
        rightSlot={
          <button onClick={load} className="flex items-center gap-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-500">
            <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      {/* 필터 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-wrap gap-2 items-center">
        {(['오늘','어제','이번주','이번달','전체기간','직접선택'] as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${period === p ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {p}
          </button>
        ))}
        {period === '직접선택' && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
            <span className="text-gray-300">~</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
          </>
        )}
        <div className="h-4 w-px bg-gray-200 mx-1" />
        <select value={selChannel} onChange={e => setSelChannel(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
          <option value="">전체 채널</option>
          {['meta','dogmaru','udak','moyo','other'].map(ch => <option key={ch} value={ch}>{CHANNEL_LABEL[ch]}</option>)}
        </select>
        <select value={selStaff} onChange={e => setSelStaff(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
          <option value="">전체 직원</option>
          {staffRows.map(r => <option key={r.staff_id} value={r.staff_id}>{r.staff_name}</option>)}
        </select>
        <select value={selProduct} onChange={e => setSelProduct(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
          <option value="">전체 상품</option>
          {['모바일','인터넷','2ND','TV프리'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={selCounted} onChange={e => setSelCounted(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
          <option value="">전체(인정+제외)</option>
          <option value="true">인정만</option>
          <option value="false">제외만</option>
        </select>
        <select value={selDevice} onChange={e => setSelDevice(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
          <option value="">전체 기기</option>
          {deviceOptions.devices.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={selPlan} onChange={e => setSelPlan(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
          <option value="">전체 요금제</option>
          {deviceOptions.plans.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={selSaleType} onChange={e => setSelSaleType(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
          <option value="">전체 가입유형</option>
          {deviceOptions.saleTypes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-[10px] text-gray-400 ml-auto">{from === to ? from : `${from} ~ ${to}`}</span>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-gray-100">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`text-xs px-4 py-2.5 font-medium border-b-2 transition-colors ${tab === t.key ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 전체 대시보드 */}
      {tab === 'overview' && (
        <>
          {/* KPI 카드 */}
          <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
            {KPI_CONFIG.map(({ key, label, color, source, actions }) => {
              const val = kpi ? (kpi as any)[key] : 0;
              return (
                <div key={key}
                  onClick={() => {
                    val > 0 && openDetail({
                      title: `${label} 상세 ${selStaff ? `· ${staffRows.find(r=>r.staff_id===selStaff)?.staff_name}` : ''} ${selChannel ? `· ${selChannel}` : ''}`,
                      dateFrom: key === 'pending_leads' ? '2020-01-01' : from,
                      dateTo: to,
                      sourceType: source === 'activity' ? 'activity' : source === 'sales' ? 'sales' : 'leads',
                      actionTypes: actions as any,
                      staffId: selStaff || undefined,
                      statusFilter: key === 'pending_leads' ? ['신규 접수','신규접수','접수','대기','상담전','미처리'] : undefined,
                    });
                  }}
                  className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center ${val > 0 ? 'cursor-pointer hover:shadow-md hover:border-pink-200' : ''} transition-all`}>
                  <div className={`text-2xl font-bold ${color}`}>{val}</div>
                  <div className="text-[11px] text-gray-400 mt-1">{label}</div>
                  <div className="text-[9px] text-gray-300 mt-0.5">
                    {source === 'leads' ? 'leads 기준' : source === 'sales' ? 'sales 기준' : 'activity 기준'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 직원별 요약 미니 */}
          <SectionCard title="직원별 오늘 업무 요약" rightSlot={
            <button onClick={() => setTab('staff')} className="text-xs text-pink-500 hover:underline">전체 보기 →</button>
          }>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-400 border-b bg-gray-50">
                  {['직원','시도','연결','부재','재케어','성공','연결률','성공률'].map(h => (
                    <th key={h} className={`py-2 px-3 font-medium ${h === '직원' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? <tr><td colSpan={8} className="py-6 text-center text-xs text-gray-400">로딩 중...</td></tr>
                    : staffRows.slice(0, 6).map(r => (
                    <tr key={r.staff_id} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-medium text-gray-800">{r.staff_name}</td>
                      {[
                        { val: r.call_attempt, actions: ['call_attempt'], label: '통화시도', cls: 'text-gray-700' },
                        { val: r.call_connected, actions: ['call_connected'], label: '연결완료', cls: 'text-indigo-600' },
                        { val: r.absent, actions: ['absent'], label: '부재', cls: 'text-orange-500' },
                        { val: r.recare, actions: ['recare_registered','recare_completed'], label: '재케어', cls: 'text-yellow-600' },
                        { val: r.consultation_success, actions: ['consultation_success'], label: '상담성공', cls: 'text-green-600 font-semibold' },
                      ].map(({ val, actions, label, cls }) => (
                        <td key={label} className="py-2.5 px-3 text-right">
                          <button onClick={() => val > 0 && openDetail({ title: `${r.staff_name} · ${label}`, dateFrom: from, dateTo: to, actionTypes: actions as any, staffId: r.staff_id })}
                            className={`${cls} ${val > 0 ? 'hover:underline cursor-pointer' : 'cursor-default'}`}>{val}</button>
                        </td>
                      ))}
                      <td className="py-2.5 px-3 text-right text-xs text-indigo-500">{r.connect_rate}%</td>
                      <td className="py-2.5 px-3 text-right text-xs text-green-600">{r.success_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}

      {/* 직원별 업무량 전체 */}
      {tab === 'staff' && (
        <SectionCard title="직원별 업무 현황">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-400 border-b bg-gray-50">
                {['직원','신규','미처리','시도','연결','부재','재케어','실패','상담성공','개통','연결률','성공률','전환율'].map(h => (
                  <th key={h} className={`py-2.5 px-3 font-medium whitespace-nowrap ${h === '직원' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? <tr><td colSpan={13} className="py-8 text-center text-xs text-gray-400">로딩 중...</td></tr>
                  : staffRows.map(r => (
                  <tr key={r.staff_id} className="hover:bg-gray-50">
                    <td className="py-3 px-3 font-medium text-gray-800 whitespace-nowrap">{r.staff_name}</td>
                    {[
                      { val: r.new_leads, label: '신규접수', cls: 'text-blue-600', src: 'leads' as const },
                      { val: r.pending_leads, label: '미처리', cls: 'text-red-500', src: 'leads' as const },
                      { val: r.call_attempt, label: '통화시도', cls: 'text-gray-700', src: 'activity' as const, actions: ['call_attempt'] },
                      { val: r.call_connected, label: '연결완료', cls: 'text-indigo-600', src: 'activity' as const, actions: ['call_connected'] },
                      { val: r.absent, label: '부재', cls: 'text-orange-500', src: 'activity' as const, actions: ['absent'] },
                      { val: r.recare, label: '재케어', cls: 'text-yellow-600', src: 'activity' as const, actions: ['recare_registered','recare_completed'] },
                      { val: r.failed, label: '실패', cls: 'text-red-500', src: 'activity' as const, actions: ['failed'] },
                      { val: r.consultation_success, label: '상담성공', cls: 'text-green-600 font-bold', src: 'activity' as const, actions: ['consultation_success'] },
                      { val: r.activation_completed, label: '개통완료', cls: 'text-pink-600 font-bold', src: 'sales' as const },
                    ].map(({ val, label, cls, src, actions }) => (
                      <td key={label} className="py-3 px-3 text-right">
                        <button onClick={() => val > 0 && openDetail({
                          title: `${r.staff_name} · ${label}`,
                          dateFrom: label === '미처리' ? '2020-01-01' : from,
                          dateTo: to,
                          sourceType: src === 'activity' ? 'activity' : src === 'sales' ? 'sales' : 'leads',
                          actionTypes: actions as any,
                          staffId: r.staff_id,
                          statusFilter: label === '미처리' ? ['신규 접수','신규접수','접수','대기','상담전','미처리'] : undefined,
                        })} className={`${cls} ${val > 0 ? 'hover:underline cursor-pointer' : 'cursor-default'}`}>{val}</button>
                      </td>
                    ))}
                    <td className="py-3 px-3 text-right text-xs text-indigo-500">{r.connect_rate}%</td>
                    <td className="py-3 px-3 text-right text-xs text-green-600">{r.success_rate}%</td>
                    <td className="py-3 px-3 text-right text-xs text-pink-600">{r.conversion_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-400 mt-3">※ 신규/미처리=leads 기준 / 업무량=activity_logs 기준 / 개통=sales 기준</p>
        </SectionCard>
      )}

      {/* 일별 추이 */}
      {tab === 'trend' && (
        <SectionCard title="일별 추이">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-400 border-b bg-gray-50">
                {['날짜','신규접수','통화시도','연결완료','부재','재케어','상담성공','개통완료'].map(h => (
                  <th key={h} className={`py-2.5 px-3 font-medium ${h === '날짜' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? <tr><td colSpan={8} className="py-8 text-center text-xs text-gray-400">로딩 중...</td></tr>
                  : trend.length === 0 ? <tr><td colSpan={8} className="py-8 text-center text-xs text-gray-400">데이터 없음</td></tr>
                  : trend.map(r => (
                  <tr key={r.date} className="hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-mono text-xs text-gray-500">{r.date}</td>
                    <td className="py-2.5 px-3 text-right text-blue-600">{r.new_leads}</td>
                    <td className="py-2.5 px-3 text-right text-gray-700">{r.call_attempt}</td>
                    <td className="py-2.5 px-3 text-right text-indigo-600">{r.call_connected}</td>
                    <td className="py-2.5 px-3 text-right text-orange-500">{r.absent}</td>
                    <td className="py-2.5 px-3 text-right text-yellow-600">{r.recare}</td>
                    <td className="py-2.5 px-3 text-right text-green-600 font-semibold">{r.consultation_success}</td>
                    <td className="py-2.5 px-3 text-right text-pink-600 font-semibold">{r.activation_completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* 채널별 성과 */}
      {tab === 'channel' && (
        <SectionCard title="채널별 성과">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-400 border-b bg-gray-50">
                {['채널','시도','연결','부재','재케어','실패','상담성공','연결률','성공률'].map(h => (
                  <th key={h} className={`py-2.5 px-3 font-medium ${h === '채널' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {channels.map(r => (
                  <tr key={r.channel} className="hover:bg-gray-50">
                    <td className="py-3 px-3 font-medium">
                      <WRBadge variant="info">{CHANNEL_LABEL[r.channel] ?? r.channel}</WRBadge>
                    </td>
                    <td className="py-3 px-3 text-right text-gray-700">{r.call_attempt}</td>
                    <td className="py-3 px-3 text-right text-indigo-600">{r.call_connected}</td>
                    <td className="py-3 px-3 text-right text-orange-500">{r.absent}</td>
                    <td className="py-3 px-3 text-right text-yellow-600">{r.recare}</td>
                    <td className="py-3 px-3 text-right text-red-500">{r.failed}</td>
                    <td className="py-3 px-3 text-right text-green-600 font-semibold">{r.consultation_success}</td>
                    <td className="py-3 px-3 text-right text-indigo-500 text-xs">{r.connect_rate}%</td>
                    <td className="py-3 px-3 text-right text-green-600 text-xs">{r.success_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}


      {/* 직원별 판매요약 */}
      {tab === 'sales_summary' && (
        <SectionCard title="직원별 판매 요약">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-400 border-b bg-gray-50">
                {['직원','전체','모바일','인터넷','2ND','TV프리','기타','인터넷설치'].map(h => (
                  <th key={h} className={`py-2.5 px-3 font-medium whitespace-nowrap ${h==='직원' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? <tr><td colSpan={8} className="py-8 text-center text-xs text-gray-400">로딩 중...</td></tr>
                  : salesSummary.length === 0 ? <tr><td colSpan={8} className="py-8 text-center text-xs text-gray-400">해당 기간 데이터 없음</td></tr>
                  : salesSummary.map(r => (
                  <tr key={r.staff_id} className="hover:bg-gray-50">
                    <td className="py-3 px-3 font-medium text-gray-800">{r.staff_name}</td>
                    {[
                      { val: r.total, label: '전체', cls: 'text-pink-600 font-bold', product: undefined },
                      { val: r.mobile, label: '모바일', cls: 'text-pink-500', product: '모바일' },
                      { val: r.internet, label: '인터넷', cls: 'text-blue-600', product: '인터넷' },
                      { val: r.second, label: '2ND', cls: 'text-gray-600', product: undefined },
                      { val: r.tvfree, label: 'TV프리', cls: 'text-purple-600', product: 'TV프리' },
                      { val: r.other, label: '기타', cls: 'text-gray-500', product: undefined },
                      { val: r.internet_install, label: '인터넷설치', cls: 'text-blue-400', product: undefined },
                    ].map(({ val, label, cls, product }) => (
                      <td key={label} className="py-3 px-3 text-right">
                        <button onClick={() => val > 0 && openDetail({
                          title: `${r.staff_name} · ${label} 개통`,
                          dateFrom: from, dateTo: to,
                          sourceType: 'sales', staffId: r.staff_id,
                        })} className={`${cls} ${val > 0 ? 'hover:underline cursor-pointer' : 'cursor-default'}`}>{val}</button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-400 mt-3">※ 개통완료 = sales.status="개통완료" / 인터넷설치 = "설치완료" / open_date 기간 기준</p>
        </SectionCard>
      )}

      {/* 상품·기기 분석 */}
      {tab === 'product_detail' && (
        <SectionCard title="직원별 상품·기기 상세">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-400 border-b bg-gray-50">
                {['직원','상품구분','기기명','요금제','가입유형','채널','건수','비중'].map(h => (
                  <th key={h} className={`py-2.5 px-3 font-medium whitespace-nowrap ${h==='직원'||h==='기기명'||h==='요금제' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? <tr><td colSpan={8} className="py-8 text-center text-xs text-gray-400">로딩 중...</td></tr>
                  : productDetail.length === 0 ? <tr><td colSpan={8} className="py-8 text-center text-xs text-gray-400">해당 기간 데이터 없음</td></tr>
                  : (() => {
                    const staffTotals = new Map<string, number>();
                    productDetail.forEach(r => staffTotals.set(r.staff_id, (staffTotals.get(r.staff_id) ?? 0) + r.count));
                    return productDetail.slice(0, 100).map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3 font-medium text-gray-800 whitespace-nowrap">{r.staff_name}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            r.bucket==='모바일' ? 'bg-pink-100 text-pink-700' :
                            r.bucket==='인터넷' ? 'bg-blue-100 text-blue-700' :
                            r.bucket==='TV프리' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                          }`}>{r.bucket}</span>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-gray-700 max-w-[140px] truncate">{r.device_model}</td>
                        <td className="py-2.5 px-3 text-xs text-gray-600 max-w-[100px] truncate">{r.rate_plan}</td>
                        <td className="py-2.5 px-3 text-right text-xs text-gray-500">{r.sale_type}</td>
                        <td className="py-2.5 px-3 text-right text-xs text-gray-500">{CHANNEL_LABELS[r.channel] ?? r.channel}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-pink-600">
                          <button onClick={() => openDetail({
                            title: `${r.staff_name} · ${r.device_model} · ${r.bucket}`,
                            dateFrom: from, dateTo: to,
                            sourceType: 'sales', staffId: r.staff_id,
                          })} className="hover:underline cursor-pointer">{r.count}</button>
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs text-gray-400">
                          {pct(r.count, staffTotals.get(r.staff_id) ?? 0)}
                        </td>
                      </tr>
                    ));
                  })()
                }
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-400 mt-3">※ 컬러/용량 필드 없음(sales DB 미저장) — 기기명(device_model) / 요금제(rate_plan) / 가입유형(sale_type) 기준</p>
        </SectionCard>
      )}

      {/* 채널 퍼널 분석 */}
      {tab === 'funnel' && (
        <SectionCard title="채널별 퍼널 분석">
          {/* 직원별 채널 집중도 */}
          <div className="mb-6">
            <h4 className="text-xs font-semibold text-gray-600 mb-3">직원별 채널 집중도 (activity_logs 기준)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-400 border-b bg-gray-50">
                  {['직원','채널','시도','연결','부재','재케어','실패','상담성공','채널집중도','연결률','성공률'].map(h => (
                    <th key={h} className={`py-2 px-2.5 font-medium whitespace-nowrap ${h==='직원'||h==='채널' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? <tr><td colSpan={11} className="py-6 text-center text-xs text-gray-400">로딩 중...</td></tr>
                    : channelFocus.length === 0 ? <tr><td colSpan={11} className="py-6 text-center text-xs text-gray-400">데이터 없음 (activity_logs 미기록)</td></tr>
                    : channelFocus.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="py-2 px-2.5 font-medium text-gray-800 whitespace-nowrap text-xs">{r.staff_name}</td>
                      <td className="py-2 px-2.5 text-xs"><WRBadge variant="info">{CHANNEL_LABELS[r.channel] ?? r.channel}</WRBadge></td>
                      <td className="py-2 px-2.5 text-right text-gray-700 text-xs">{r.call_attempt}</td>
                      <td className="py-2 px-2.5 text-right text-indigo-600 text-xs">{r.call_connected}</td>
                      <td className="py-2 px-2.5 text-right text-orange-500 text-xs">{r.absent}</td>
                      <td className="py-2 px-2.5 text-right text-yellow-600 text-xs">{r.recare}</td>
                      <td className="py-2 px-2.5 text-right text-red-500 text-xs">{r.failed}</td>
                      <td className="py-2 px-2.5 text-right text-green-600 font-semibold text-xs">{r.consultation_success}</td>
                      <td className="py-2 px-2.5 text-right text-xs font-semibold text-pink-600">{r.focus_rate}%</td>
                      <td className="py-2 px-2.5 text-right text-xs text-indigo-500">{r.connect_rate}%</td>
                      <td className="py-2 px-2.5 text-right text-xs text-green-600">{r.success_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* 채널별 퍼널 */}
          <div>
            <h4 className="text-xs font-semibold text-gray-600 mb-3">채널별 유입→개통 퍼널</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-400 border-b bg-gray-50">
                  {['채널','신규접수','통화시도','연결완료','상담성공','개통완료','시도율','연결률','상담성공률','개통전환율'].map(h => (
                    <th key={h} className={`py-2.5 px-3 font-medium whitespace-nowrap ${h==='채널' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? <tr><td colSpan={10} className="py-6 text-center text-xs text-gray-400">로딩 중...</td></tr>
                    : funnelRows.map(r => (
                    <tr key={r.channel} className="hover:bg-gray-50">
                      <td className="py-3 px-3"><WRBadge variant="info">{CHANNEL_LABELS[r.channel] ?? r.channel}</WRBadge></td>
                      <td className="py-3 px-3 text-right text-blue-600 font-semibold">{r.new_leads}</td>
                      <td className="py-3 px-3 text-right text-gray-700">{r.call_attempt}</td>
                      <td className="py-3 px-3 text-right text-indigo-600">{r.call_connected}</td>
                      <td className="py-3 px-3 text-right text-green-600 font-semibold">{r.consultation_success}</td>
                      <td className="py-3 px-3 text-right text-pink-600 font-bold">{r.activation_completed}</td>
                      <td className="py-3 px-3 text-right text-xs">{r.try_rate > 0 ? `${r.try_rate}%` : '-'}</td>
                      <td className="py-3 px-3 text-right text-xs text-indigo-500">{r.connect_rate > 0 ? `${r.connect_rate}%` : '-'}</td>
                      <td className="py-3 px-3 text-right text-xs text-green-600">{r.success_rate > 0 ? `${r.success_rate}%` : '-'}</td>
                      <td className="py-3 px-3 text-right text-xs font-semibold text-pink-600">{r.conversion_rate > 0 ? `${r.conversion_rate}%` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-3">※ 신규접수=leads기준 / 시도~상담=activity_logs기준 / 개통=sales기준</p>
        </SectionCard>
      )}

      {/* 직원별 판매 요약 */}
      {tab === 'sales_summary' && (
        <div className="space-y-4">
          <SectionCard title="직원별 판매 요약">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-400 border-b bg-gray-50">
                  {['직원','전체','모바일','인터넷','2ND','TV프리','모요','도그마루','유닥','메타','설치완료'].map(h => (
                    <th key={h} className={`py-2.5 px-3 font-medium whitespace-nowrap ${h==='직원'?'text-left':'text-right'}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? <tr><td colSpan={11} className="py-8 text-center text-xs text-gray-400">로딩 중...</td></tr>
                    : salesSummary.map(r => (
                    <tr key={r.staff_name} className="hover:bg-gray-50">
                      <td className="py-3 px-3 font-medium text-gray-800 whitespace-nowrap">{r.staff_name}</td>
                      {[
                        { val: r.total, label: '전체 개통', cls: 'text-pink-600 font-bold', statuses: ['개통완료'] },
                        { val: r.mobile, label: '모바일', cls: 'text-pink-500', statuses: ['개통완료'] },
                        { val: r.internet, label: '인터넷', cls: 'text-blue-600', statuses: ['개통완료'] },
                        { val: r.second, label: '2ND', cls: 'text-gray-600', statuses: ['개통완료'] },
                        { val: r.tvfree, label: 'TV프리', cls: 'text-purple-600', statuses: ['개통완료'] },
                        { val: r.moyo, label: '모요', cls: 'text-gray-700', statuses: ['개통완료'] },
                        { val: r.dogmaru, label: '도그마루', cls: 'text-gray-700', statuses: ['개통완료'] },
                        { val: r.udak, label: '유닥', cls: 'text-gray-700', statuses: ['개통완료'] },
                        { val: r.meta, label: '메타', cls: 'text-gray-700', statuses: ['개통완료'] },
                        { val: r.install_completed, label: '설치완료', cls: 'text-blue-400', statuses: ['설치완료'] },
                      ].map(({ val, label, cls }) => (
                        <td key={label} className="py-3 px-3 text-right">
                          <button onClick={() => val > 0 && openDetail({
                            title: `${r.staff_name} · ${label}`,
                            dateFrom: from, dateTo: to, sourceType: 'sales',
                            staffId: staffRows.find(s => s.staff_name === r.staff_name)?.staff_id,
                          })} className={`${cls} ${val > 0 ? 'hover:underline cursor-pointer' : 'cursor-default'}`}>{val}</button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="직원별 채널 판매 breakdown">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-400 border-b bg-gray-50">
                  {['직원','채널','전체','모바일','인터넷','2ND','TV프리','주요기기','주요요금제','비중'].map(h => (
                    <th key={h} className={`py-2.5 px-3 font-medium whitespace-nowrap ${h==='직원'||h==='채널'||h==='주요기기'||h==='주요요금제'?'text-left':'text-right'}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? <tr><td colSpan={10} className="py-8 text-center text-xs text-gray-400">로딩 중...</td></tr>
                    : channelSales.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-medium text-gray-800 whitespace-nowrap">{r.staff_name}</td>
                      <td className="py-2.5 px-3"><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">{CHANNEL_LABEL[r.channel] ?? r.channel}</span></td>
                      <td className="py-2.5 px-3 text-right font-bold text-pink-600">{r.total}</td>
                      <td className="py-2.5 px-3 text-right text-pink-500">{r.mobile}</td>
                      <td className="py-2.5 px-3 text-right text-blue-600">{r.internet}</td>
                      <td className="py-2.5 px-3 text-right text-gray-600">{r.second}</td>
                      <td className="py-2.5 px-3 text-right text-purple-600">{r.tvfree}</td>
                      <td className="py-2.5 px-3 text-xs text-gray-600 max-w-[100px] truncate">{r.top_device}</td>
                      <td className="py-2.5 px-3 text-xs text-gray-600 max-w-[100px] truncate">{r.top_rate_plan}</td>
                      <td className="py-2.5 px-3 text-right text-xs text-gray-500">{r.share_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* 상품·기기 분석 */}
      {tab === 'product_device' && (
        <SectionCard title="상품·기기 분석">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-400 border-b bg-gray-50">
                {['직원','채널','상품','기기명','요금제','가입유형','개통방식','지원유형','건수','비중'].map(h => (
                  <th key={h} className={`py-2.5 px-3 font-medium whitespace-nowrap ${h==='건수'||h==='비중'?'text-right':'text-left'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? <tr><td colSpan={10} className="py-8 text-center text-xs text-gray-400">로딩 중...</td></tr>
                  : productDetail.slice(0, 100).map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-medium text-gray-800 whitespace-nowrap">{r.staff_name}</td>
                    <td className="py-2.5 px-3"><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">{CHANNEL_LABEL[r.channel] ?? r.channel}</span></td>
                    <td className="py-2.5 px-3 text-xs text-gray-600">{r.product}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-800 font-medium max-w-[120px] truncate">{r.device_model}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-600 max-w-[100px] truncate">{r.rate_plan}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-600">{r.sale_type}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-600">{r.open_method}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-600">{r.contract_type}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-pink-600">{r.count}</td>
                    <td className="py-2.5 px-3 text-right text-xs text-gray-500">{r.share_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {productDetail.length > 100 && <p className="text-xs text-gray-400 mt-2">상위 100개 표시 중 (전체 {productDetail.length}개 조합)</p>}
          </div>
        </SectionCard>
      )}

      {/* 채널 퍼널 */}
      {tab === 'funnel' && (
        <div className="space-y-4">
          <SectionCard title="채널별 퍼널 분석">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-400 border-b bg-gray-50">
                  {['채널','신규접수','통화시도','연결완료','부재','재케어','상담성공','개통완료','시도율','연결률','성공률','전환율'].map(h => (
                    <th key={h} className={`py-2.5 px-3 font-medium whitespace-nowrap ${h==='채널'?'text-left':'text-right'}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? <tr><td colSpan={12} className="py-8 text-center text-xs text-gray-400">로딩 중...</td></tr>
                    : funnelRows.map(r => (
                    <tr key={r.channel} className="hover:bg-gray-50">
                      <td className="py-3 px-3"><WRBadge variant="info">{CHANNEL_LABEL[r.channel] ?? r.channel}</WRBadge></td>
                      <td className="py-3 px-3 text-right text-blue-600">{r.new_leads}</td>
                      <td className="py-3 px-3 text-right text-gray-700">{r.call_attempt}</td>
                      <td className="py-3 px-3 text-right text-indigo-600">{r.call_connected}</td>
                      <td className="py-3 px-3 text-right text-orange-500">{r.absent}</td>
                      <td className="py-3 px-3 text-right text-yellow-600">{r.recare}</td>
                      <td className="py-3 px-3 text-right text-green-600 font-semibold">{r.consultation_success}</td>
                      <td className="py-3 px-3 text-right text-pink-600 font-bold">{r.activation_completed}</td>
                      <td className="py-3 px-3 text-right text-xs text-gray-500">{r.try_rate > 0 ? `${r.try_rate}%` : '-'}</td>
                      <td className="py-3 px-3 text-right text-xs text-indigo-500">{r.connect_rate > 0 ? `${r.connect_rate}%` : '-'}</td>
                      <td className="py-3 px-3 text-right text-xs text-green-600">{r.success_rate > 0 ? `${r.success_rate}%` : '-'}</td>
                      <td className="py-3 px-3 text-right text-xs text-pink-600">{r.conversion_rate > 0 ? `${r.conversion_rate}%` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="직원별 채널 집중도">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-400 border-b bg-gray-50">
                  {['직원','채널','시도','연결','부재','재케어','상담성공','집중도','연결률','성공률'].map(h => (
                    <th key={h} className={`py-2.5 px-3 font-medium whitespace-nowrap ${h==='직원'||h==='채널'?'text-left':'text-right'}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? <tr><td colSpan={10} className="py-8 text-center text-xs text-gray-400">로딩 중...</td></tr>
                    : channelFocus.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-medium text-gray-800 whitespace-nowrap">{r.staff_name}</td>
                      <td className="py-2.5 px-3"><WRBadge variant="info">{CHANNEL_LABEL[r.channel] ?? r.channel}</WRBadge></td>
                      <td className="py-2.5 px-3 text-right text-gray-700">{r.call_attempt}</td>
                      <td className="py-2.5 px-3 text-right text-indigo-600">{r.call_connected}</td>
                      <td className="py-2.5 px-3 text-right text-orange-500">{r.absent}</td>
                      <td className="py-2.5 px-3 text-right text-yellow-600">{r.recare}</td>
                      <td className="py-2.5 px-3 text-right text-green-600 font-semibold">{r.consultation_success}</td>
                      <td className="py-2.5 px-3 text-right text-xs font-semibold text-pink-600">{r.focus_pct}%</td>
                      <td className="py-2.5 px-3 text-right text-xs text-indigo-500">{r.connect_rate > 0 ? `${r.connect_rate}%` : '-'}</td>
                      <td className="py-2.5 px-3 text-right text-xs text-green-600">{r.success_rate > 0 ? `${r.success_rate}%` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* 이상 알림 */}
      {tab === 'alerts' && (
        <SectionCard title="이상/주의 알림">
          {alerts.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">현재 이상 항목이 없습니다. ✅</div>
          ) : (
            <div className="space-y-2">
              {alerts.map(a => (
                <div key={a.type} className={`flex items-center justify-between rounded-xl px-4 py-3 border ${
                  a.severity === 'danger' ? 'bg-red-50 border-red-200' :
                  a.severity === 'warning' ? 'bg-orange-50 border-orange-200' :
                  'bg-blue-50 border-blue-100'
                }`}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`size-4 ${a.severity === 'danger' ? 'text-red-500' : a.severity === 'warning' ? 'text-orange-500' : 'text-blue-400'}`} />
                    <span className="text-sm font-medium text-gray-800">{a.label}</span>
                  </div>
                  <span className={`text-lg font-bold ${a.severity === 'danger' ? 'text-red-600' : a.severity === 'warning' ? 'text-orange-600' : 'text-blue-600'}`}>{a.count}건</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* 데이터 기준 안내 */}
      <div className="text-[11px] text-gray-400 bg-gray-50 rounded-xl p-3 border border-gray-100">
        신규접수 = leads.created_at 기준 &nbsp;|&nbsp;
        업무량 = activity_logs.created_at 기준 (is_counted=true) &nbsp;|&nbsp;
        개통완료 = sales.open_date 기준 &nbsp;|&nbsp;
        전화번호 미노출 &nbsp;|&nbsp; 고객명 마스킹
      </div>
    </div>
  );
}
