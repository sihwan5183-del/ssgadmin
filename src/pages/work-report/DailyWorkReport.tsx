// ============================================================
// 일일 업무보고 — mock data 기반 레이아웃 (1단계)
// ============================================================
import { useState, useCallback } from 'react';
import { Copy, Save, Download } from 'lucide-react';
import { toast } from 'sonner';
import { WorkReportHeader, SectionCard, FilterButtons } from './_shared';
import { mockDailyReport } from '@/data/workReportMockData';

const CHANNEL_OPTIONS = ['전체', '모요', '대표번호', 'SNS', '도그마루'];
const TEAM_OPTIONS = ['온라인 마케팅팀', '전체'];

function buildReportText(r: typeof mockDailyReport): string {
  const s = r.summary;
  const lines: string[] = [
    `■ ${r.report_date} ${r.team} 일일 업무보고`,
    '',
    '[전체 요약]',
    `- 통화시도: ${s.callAttempt}건`,
    `- 연결완료: ${s.connected}건`,
    `- 부재: ${s.absence}건`,
    `- 재케어 처리: ${s.recare}건`,
    `- 실패: ${s.failed}건`,
    `- 상담성공: ${s.consultSuccess}건`,
    `- 택배발송: ${s.deliverySent}건`,
    `- 개통완료: ${s.openingComplete}건`,
    '',
    '[개통 완료건]',
    ...r.successList.map((x, i) =>
      `${i + 1}. ${x.manager} / ${x.channel} / ${x.customer} / ${x.type} / ${x.device} / ${x.plan}`
    ),
    '',
    '[진행 예정건]',
    ...r.progressList.map((x, i) =>
      `${i + 1}. ${x.manager} / ${x.channel} / ${x.customer} / ${x.type} / ${x.device} / ${x.plan} / ${x.note}`
    ),
    '',
    '[실패 요약]',
    ...r.failSummary.map((x) => `- ${x.reason}: ${x.count}건`),
    '',
    '[담당자별]',
    ...r.memberSummary.map(
      (x) =>
        `- ${x.name}: 시도 ${x.attempt} / 연결 ${x.connected} / 부재 ${x.absence} / 재케어 ${x.recare} / 실패 ${x.failed} / 성공 ${x.success}`
    ),
  ];
  return lines.join('\n');
}

export default function DailyWorkReport() {
  const [channel, setChannel] = useState('전체');
  const [team, setTeam] = useState('온라인 마케팅팀');
  const r = mockDailyReport;
  const reportText = buildReportText(r);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(reportText).then(() => toast.success('카톡 보고문이 복사되었습니다.'));
  }, [reportText]);

  return (
    <div className="space-y-5">
      <WorkReportHeader
        title="일일 업무보고"
        description="카톡방 수기 보고를 전산 데이터 기반으로 자동 생성합니다."
        rightSlot={
          <>
            <input
              type="date"
              defaultValue={r.report_date}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none"
            />
            <select
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none"
            >
              {TEAM_OPTIONS.map((t) => <option key={t}>{t}</option>)}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 왼쪽: 보고서 미리보기 */}
        <SectionCard
          title="보고서 미리보기"
          rightSlot={
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs bg-pink-500 hover:bg-pink-600 text-white rounded-lg px-3 py-1.5 font-medium transition-colors"
              >
                <Copy className="size-3" />카톡 보고문 복사
              </button>
              <button className="flex items-center gap-1 text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg px-3 py-1.5 font-medium transition-colors">
                <Save className="size-3" />저장
              </button>
              <button className="flex items-center gap-1 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-3 py-1.5 font-medium transition-colors">
                <Download className="size-3" />엑셀
              </button>
            </div>
          }
        >
          <pre className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-mono bg-gray-50 rounded-lg p-4 border border-gray-100 max-h-[520px] overflow-y-auto">
            {reportText}
          </pre>
        </SectionCard>

        {/* 오른쪽: 항목별 편집 뷰 */}
        <div className="space-y-4">
          {/* 전체 요약 */}
          <SectionCard title="전체 요약">
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(r.summary).map(([k, v]) => {
                const labelMap: Record<string, string> = {
                  callAttempt: '통화시도', connected: '연결완료', absence: '부재',
                  recare: '재케어', failed: '실패', consultSuccess: '상담성공',
                  deliverySent: '택배발송', openingComplete: '개통완료',
                };
                return (
                  <div key={k} className="bg-gray-50 rounded-lg p-2.5 text-center border border-gray-100">
                    <div className="text-lg font-bold text-gray-900">{v}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{labelMap[k] ?? k}</div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* 개통 완료건 */}
          <SectionCard title="개통 완료건">
            <div className="space-y-1.5">
              {r.successList.map((x, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-700 bg-green-50 rounded-lg px-3 py-2 border border-green-100">
                  <span className="text-green-600 font-bold w-4 shrink-0">{i + 1}</span>
                  <span>{x.manager}</span><span className="text-gray-300">/</span>
                  <span>{x.customer}</span><span className="text-gray-300">/</span>
                  <span>{x.type}</span><span className="text-gray-300">/</span>
                  <span className="text-pink-600 font-medium">{x.plan}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* 진행 예정건 */}
          <SectionCard title="진행 예정건">
            <div className="space-y-1.5">
              {r.progressList.map((x, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-700 bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
                  <span className="text-blue-600 font-bold w-4 shrink-0">{i + 1}</span>
                  <span>{x.manager}</span><span className="text-gray-300">/</span>
                  <span>{x.customer}</span><span className="text-gray-300">/</span>
                  <span>{x.type}</span><span className="text-gray-300">/</span>
                  <span className="text-blue-600 font-medium">{x.note}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* 실패 요약 */}
          <SectionCard title="실패 요약">
            <div className="grid grid-cols-2 gap-2">
              {r.failSummary.map((x) => (
                <div key={x.reason} className="flex justify-between items-center text-xs bg-red-50 rounded-lg px-3 py-2 border border-red-100">
                  <span className="text-gray-700">{x.reason}</span>
                  <span className="font-bold text-red-500">{x.count}건</span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* 담당자별 */}
          <SectionCard title="담당자별">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  {['담당자', '시도', '연결', '부재', '재케어', '실패', '성공'].map((h) => (
                    <th key={h} className={`py-2 font-medium ${h === '담당자' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {r.memberSummary.map((m) => (
                  <tr key={m.name} className="text-gray-700">
                    <td className="py-2 font-medium">{m.name}</td>
                    <td className="py-2 text-right">{m.attempt}</td>
                    <td className="py-2 text-right text-indigo-600">{m.connected}</td>
                    <td className="py-2 text-right text-orange-500">{m.absence}</td>
                    <td className="py-2 text-right text-yellow-600">{m.recare}</td>
                    <td className="py-2 text-right text-red-500">{m.failed}</td>
                    <td className="py-2 text-right text-green-600 font-bold">{m.success}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
