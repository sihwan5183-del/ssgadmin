// ============================================================
// 내 업무 대시보드 — mock data 기반 레이아웃 (1단계)
// ============================================================
import { useState } from 'react';
import { RefreshCw, Copy, ChevronRight } from 'lucide-react';
import { WorkReportHeader, KpiCard, SectionCard, FilterButtons } from './_shared';
import {
  mockMyDailySummary,
  mockMyConversionFlow,
  mockMyProgressCards,
  mockMySuccessList,
  mockMyIncentiveSummary,
} from '@/data/workReportMockData';

const PERIOD_OPTIONS = ['오늘', '어제', '이번주', '이번달', '기간설정'];
const CHANNEL_OPTIONS = ['전체', '모요', '대표번호', 'SNS', '도그마루'];

export default function MyWorkDashboard() {
  const [period, setPeriod] = useState('오늘');
  const [channel, setChannel] = useState('전체');

  const inc = mockMyIncentiveSummary;

  return (
    <div className="space-y-5">
      <WorkReportHeader
        title="내 업무 대시보드"
        description="오늘 내 상담 활동, 성공건, 지연건, 예상 인센을 확인합니다."
        rightSlot={
          <>
            <FilterButtons options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-pink-300"
            >
              {CHANNEL_OPTIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
              <RefreshCw className="size-3" />
              새로고침
            </button>
          </>
        }
      />

      {/* 1구역: 오늘 내 업무 요약 */}
      <SectionCard title="오늘 내 업무 요약">
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
          {mockMyDailySummary.map((card) => (
            <KpiCard
              key={card.label}
              label={card.label}
              value={card.count}
              sub={
                card.countedCount !== undefined
                  ? `전체로그 ${card.totalLogCount}건 / 인정 ${card.countedCount}건`
                  : undefined
              }
              color={card.color as any}
            />
          ))}
        </div>
      </SectionCard>

      {/* 2구역: 내 전환 흐름 */}
      <SectionCard title="내 전환 흐름">
        <div className="flex items-center gap-1 flex-wrap">
          {mockMyConversionFlow.map((step, idx) => (
            <div key={step.label} className="flex items-center gap-1">
              <div className="flex flex-col items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 min-w-[72px]">
                <div className="text-xs text-gray-500 mb-1">{step.label}</div>
                <div className="text-lg font-bold text-gray-900">{step.count}</div>
                {idx > 0 && (
                  <div className="text-[10px] text-pink-500 font-medium">
                    {mockMyConversionFlow[idx - 1].count > 0
                      ? `${Math.round((step.count / mockMyConversionFlow[idx - 1].count) * 100)}%`
                      : '-'}
                  </div>
                )}
              </div>
              {idx < mockMyConversionFlow.length - 1 && (
                <ChevronRight className="size-4 text-gray-300 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* 3구역: 내 진행 중인 건 */}
      <SectionCard title="내 진행 중인 건">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {mockMyProgressCards.map((card) => {
            const colorMap: Record<string, string> = {
              yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
              orange: 'bg-orange-50 border-orange-200 text-orange-700',
              blue: 'bg-blue-50 border-blue-200 text-blue-700',
              red: 'bg-red-50 border-red-200 text-red-700',
              gray: 'bg-gray-50 border-gray-200 text-gray-500',
            };
            return (
              <div
                key={card.label}
                className={`rounded-xl border p-4 text-center ${colorMap[card.color] ?? colorMap.gray}`}
              >
                <div className="text-2xl font-bold">{card.count}</div>
                <div className="text-[11px] mt-1 leading-tight opacity-80">{card.label}</div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* 4구역: 오늘 성공건 */}
      <SectionCard
        title="오늘 성공건"
        rightSlot={
          <div className="flex gap-2">
            <button className="flex items-center gap-1 text-xs bg-pink-500 hover:bg-pink-600 text-white rounded-lg px-3 py-1.5 font-medium transition-colors">
              <Copy className="size-3" />카톡 공유문 복사
            </button>
            <button className="text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg px-3 py-1.5 font-medium transition-colors">
              일일보고에 포함
            </button>
          </div>
        }
      >
        <div className="space-y-2">
          {mockMySuccessList.map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-sm bg-green-50 rounded-lg px-4 py-3 border border-green-100">
              <span className="text-green-600 font-bold text-xs w-5 shrink-0">{i + 1}</span>
              <span className="font-medium text-gray-800">{item.manager}</span>
              <span className="text-gray-400">/</span>
              <span className="text-gray-600">{item.channel}</span>
              <span className="text-gray-400">/</span>
              <span className="text-gray-800 font-medium">{item.customer_name}</span>
              <span className="text-gray-400">/</span>
              <span className="text-gray-600">{item.product}</span>
              <span className="text-gray-400">/</span>
              <span className="text-gray-600">{item.device}</span>
              <span className="text-gray-400">/</span>
              <span className="text-pink-600 font-semibold">{item.plan}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* 6구역: 이번달 인센 예상 */}
      <SectionCard title="이번달 인센 예상">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">적용월</span>
              <span className="font-semibold">{inc.apply_month}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">정산확정</span>
              <span className="font-bold text-green-600">{inc.confirmed_count}건</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">정산대기</span>
              <span className="font-semibold text-blue-600">{inc.pending_count}건</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">철회/제외</span>
              <span className="font-semibold text-gray-400">{inc.excluded_count}건</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">적용구간</span>
              <span className="font-semibold">{inc.applied_tier}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">단가</span>
              <span className="font-semibold">{inc.unit_price.toLocaleString()}원/건</span>
            </div>
          </div>
          <div className="col-span-2 lg:col-span-1 bg-pink-50 border border-pink-200 rounded-xl p-4 flex flex-col items-center justify-center">
            <div className="text-xs text-pink-500 font-medium mb-1">예상 인센</div>
            <div className="text-3xl font-bold text-pink-600">{inc.estimated_amount.toLocaleString()}원</div>
            <div className="text-[10px] text-gray-400 mt-2 text-center leading-tight">
              예상 인센은 정산확정 건 기준이며,<br />정산대기 건은 확정 전 참고 금액입니다.
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
