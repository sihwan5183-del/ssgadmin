// ============================================================
// 팀 업무 현황 — mock data 기반 레이아웃 (1단계)
// ============================================================
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { WorkReportHeader, KpiCard, SectionCard, FilterButtons, WRBadge } from './_shared';
import {
  mockTeamSummary,
  mockTeamCompare,
  mockTeamMembers,
  mockAnomalyLogs,
} from '@/data/workReportMockData';

const PERIOD_OPTIONS = ['오늘', '이번주', '이번달'];
const STAFF_OPTIONS = ['전체', '최윤정', '김경환', '오미나'];
const CHANNEL_OPTIONS = ['전체', '모요', '대표번호', 'SNS', '도그마루'];

const anomalyTypeLabel: Record<string, string> = {
  '10분내_중복통화': '10분 내 중복통화',
  '부재4회이상': '부재 4회 이상',
  '실패사유_미입력': '실패사유 미입력',
  '진행예정_다음액션없음': '진행예정 다음액션 없음',
  '상담성공_택배미발송_2일초과': '상담성공→택배미발송 2일 초과',
  '택배발송_개통미완료_4일초과': '택배발송→개통미완료 4일 초과',
  '개통완료_정산미확정_3일초과': '개통완료→정산미확정 3일 초과',
};

function DeltaBadge({ now, prev }: { now: number; prev: number }) {
  const diff = now - prev;
  if (diff === 0) return <span className="text-gray-400 text-xs">-</span>;
  return (
    <span className={`text-xs font-semibold ${diff > 0 ? 'text-green-600' : 'text-red-500'}`}>
      {diff > 0 ? '+' : ''}{diff}
    </span>
  );
}

export default function TeamWorkDashboard() {
  const [period, setPeriod] = useState('오늘');
  const [staff, setStaff] = useState('전체');
  const [channel, setChannel] = useState('전체');

  const tc = mockTeamCompare;

  return (
    <div className="space-y-5">
      <WorkReportHeader
        title="팀 업무 현황"
        description="팀 전체 업무량, 담당자별 성과, 전일/전주 비교, 이상 로그를 확인합니다."
        rightSlot={
          <>
            <FilterButtons options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
            <select
              value={staff}
              onChange={(e) => setStaff(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none"
            >
              {STAFF_OPTIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none"
            >
              {CHANNEL_OPTIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </>
        }
      />

      {/* 전체 요약 카드 */}
      <SectionCard title="전체 요약">
        <div className="grid grid-cols-3 lg:grid-cols-9 gap-3">
          {mockTeamSummary.map((card, i) => {
            const colors = ['gray','blue','indigo','orange','yellow','red','green','pink','purple'] as const;
            return <KpiCard key={card.label} label={card.label} value={card.count} color={colors[i] as any} />;
          })}
        </div>
      </SectionCard>

      {/* 전일/전주 비교 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="전일 비교 (현재 시간 기준)">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                <th className="text-left py-2 font-medium">항목</th>
                <th className="text-right py-2 font-medium">오늘</th>
                <th className="text-right py-2 font-medium">어제</th>
                <th className="text-right py-2 font-medium">차이</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { label: '통화시도', now: tc.today.callAttempt, prev: tc.yesterday.callAttempt },
                { label: '연결완료', now: tc.today.connected, prev: tc.yesterday.connected },
                { label: '부재', now: tc.today.absence, prev: tc.yesterday.absence },
                { label: '상담성공', now: tc.today.success, prev: tc.yesterday.success },
                { label: '개통완료', now: tc.today.opening, prev: tc.yesterday.opening },
              ].map((row) => (
                <tr key={row.label} className="text-gray-700">
                  <td className="py-2 text-gray-600 text-xs">{row.label}</td>
                  <td className="py-2 text-right font-semibold">{row.now}</td>
                  <td className="py-2 text-right text-gray-400">{row.prev}</td>
                  <td className="py-2 text-right"><DeltaBadge now={row.now} prev={row.prev} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard title="전주 비교 (같은 요일·시간 기준)">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                <th className="text-left py-2 font-medium">항목</th>
                <th className="text-right py-2 font-medium">이번주</th>
                <th className="text-right py-2 font-medium">저번주</th>
                <th className="text-right py-2 font-medium">차이</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { label: '통화시도', now: tc.thisWeek.callAttempt, prev: tc.lastWeek.callAttempt },
                { label: '연결완료', now: tc.thisWeek.connected, prev: tc.lastWeek.connected },
                { label: '부재', now: tc.thisWeek.absence, prev: tc.lastWeek.absence },
                { label: '상담성공', now: tc.thisWeek.success, prev: tc.lastWeek.success },
                { label: '개통완료', now: tc.thisWeek.opening, prev: tc.lastWeek.opening },
              ].map((row) => (
                <tr key={row.label} className="text-gray-700">
                  <td className="py-2 text-gray-600 text-xs">{row.label}</td>
                  <td className="py-2 text-right font-semibold">{row.now}</td>
                  <td className="py-2 text-right text-gray-400">{row.prev}</td>
                  <td className="py-2 text-right"><DeltaBadge now={row.now} prev={row.prev} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>

      {/* 담당자별 표 */}
      <SectionCard title="담당자별 업무 현황">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                {['담당자', '배정', '시도', '연결', '부재', '재케어', '실패', '상담성공', '개통완료', '정산확정', '전환율'].map((h) => (
                  <th key={h} className={`py-2.5 px-3 font-medium ${h === '담당자' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {mockTeamMembers.map((m) => (
                <tr key={m.user_id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-3 font-medium text-gray-800">{m.user_name}</td>
                  <td className="py-3 px-3 text-right text-gray-600">{m.assigned}</td>
                  <td className="py-3 px-3 text-right text-gray-700 font-medium">{m.callAttempt}</td>
                  <td className="py-3 px-3 text-right text-indigo-600">{m.callConnected}</td>
                  <td className="py-3 px-3 text-right text-orange-500">{m.noAnswer}</td>
                  <td className="py-3 px-3 text-right text-yellow-600">{m.recare}</td>
                  <td className="py-3 px-3 text-right text-red-500">{m.failed}</td>
                  <td className="py-3 px-3 text-right text-green-600 font-semibold">{m.consultSuccess}</td>
                  <td className="py-3 px-3 text-right text-pink-600 font-semibold">{m.openingComplete}</td>
                  <td className="py-3 px-3 text-right text-purple-600 font-bold">{m.settlementConfirmed}</td>
                  <td className="py-3 px-3 text-right">
                    <span className="text-xs font-semibold text-pink-500">{m.conversionRate}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* 이상 로그 */}
      <SectionCard
        title="이상 로그"
        rightSlot={
          <span className="text-xs text-red-500 font-medium flex items-center gap-1">
            <AlertTriangle className="size-3" />
            {mockAnomalyLogs.length}건
          </span>
        }
      >
        {mockAnomalyLogs.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">이상 로그가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {mockAnomalyLogs.map((log) => (
              <div key={log.log_id} className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                <AlertTriangle className="size-4 text-red-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <WRBadge variant="danger">{anomalyTypeLabel[log.anomaly_type] ?? log.anomaly_type}</WRBadge>
                    <span className="text-xs font-semibold text-gray-700">{log.user_name}</span>
                    <span className="text-xs text-gray-400">/</span>
                    <span className="text-xs text-gray-600">{log.customer_name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{log.occurred_at}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{log.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
