// ============================================================
// 리포트 설정 — mock data 기반 레이아웃 (1단계)
// ============================================================
import { useState } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { WorkReportHeader, SectionCard } from './_shared';
import { mockIncentivePolicies } from '@/data/workReportMockData';

function ToggleSetting({ label, description, defaultChecked }: { label: string; description?: string; defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked ?? false);
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div>
        <div className="text-sm font-medium text-gray-800">{label}</div>
        {description && <div className="text-xs text-gray-400 mt-0.5">{description}</div>}
      </div>
      <button
        onClick={() => setChecked((v) => !v)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-pink-500' : 'bg-gray-200'}`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

function NumberSetting({ label, defaultValue, unit }: { label: string; defaultValue: number; unit?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div className="text-sm font-medium text-gray-800">{label}</div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          defaultValue={defaultValue}
          className="w-16 text-right text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-pink-300"
        />
        {unit && <span className="text-xs text-gray-400">{unit}</span>}
      </div>
    </div>
  );
}

export default function ReportSettings() {
  const handleSave = () => toast.success('설정이 저장되었습니다.');

  return (
    <div className="space-y-5">
      <WorkReportHeader
        title="리포트 설정"
        description="업무량 인정 기준, 인센 정책, 보고서 양식을 관리자가 직접 설정합니다."
        rightSlot={
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 text-xs bg-pink-500 hover:bg-pink-600 text-white rounded-lg px-4 py-2 font-medium transition-colors"
          >
            <Save className="size-3.5" />저장
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 업무량 인정 기준 */}
        <SectionCard title="업무량 인정 기준">
          <NumberSetting label="동일 고객 동일 행동 중복 제한 시간" defaultValue={10} unit="분" />
          <NumberSetting label="동일 고객 부재 인정 횟수 (일 최대)" defaultValue={3} unit="회" />
          <NumberSetting label="동일 고객 문자발송 인정 횟수 (일 최대)" defaultValue={2} unit="회" />
          <div className="py-3 border-b border-gray-50">
            <div className="text-sm font-medium text-gray-800 mb-2">실패처리 필수 입력값</div>
            <div className="space-y-1.5">
              {['실패사유', '상담요약'].map((item) => (
                <label key={item} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded accent-pink-500" />
                  {item}
                </label>
              ))}
            </div>
          </div>
          <div className="py-3">
            <div className="text-sm font-medium text-gray-800 mb-2">재케어완료 필수 입력값</div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded accent-pink-500" />
              다음 예정 연락 시간
            </label>
          </div>
        </SectionCard>

        {/* 보고서 양식 설정 */}
        <SectionCard title="보고서 양식 설정">
          <ToggleSetting label="고객명 마스킹" description="보고서에 고객명 마스킹 (김** 형태)" defaultChecked={true} />
          <ToggleSetting label="연락처 표시" description="보고서에 연락처 포함" defaultChecked={false} />
          <ToggleSetting label="실패 사유 포함" description="보고서에 실패 사유 요약 포함" defaultChecked={true} />
          <ToggleSetting label="담당자별 요약 포함" description="담당자별 업무량 요약 포함" defaultChecked={true} />
          <ToggleSetting label="성공건 상세 포함" description="개통완료건 상세 목록 포함" defaultChecked={true} />
          <ToggleSetting label="진행예정건 포함" description="택배대기/개통대기 진행건 포함" defaultChecked={true} />
        </SectionCard>
      </div>

      {/* 인센 정책 설정 */}
      <SectionCard
        title="인센 정책"
        rightSlot={
          <button className="flex items-center gap-1 text-xs bg-pink-500 hover:bg-pink-600 text-white rounded-lg px-3 py-1.5 font-medium transition-colors">
            <Plus className="size-3" />구간 추가
          </button>
        }
      >
        <div className="mb-3 flex gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium">적용월</label>
            <input
              type="month"
              defaultValue="2026-06"
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-pink-300"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium">계산방식</label>
            <select
              defaultValue="최종구간일괄"
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
            >
              <option>최종구간일괄</option>
              <option>구간별누적</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                {['구간 시작', '구간 종료', '건당 단가', '상품구분', '활성', ''].map((h) => (
                  <th key={h} className="py-2.5 px-3 font-medium text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {mockIncentivePolicies.map((pol, i) => (
                <tr key={pol.id} className="hover:bg-gray-50">
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      defaultValue={pol.range_start}
                      className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-pink-300"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      defaultValue={pol.range_end ?? ''}
                      placeholder="이상"
                      className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-pink-300"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        defaultValue={pol.unit_price}
                        className="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-pink-300"
                      />
                      <span className="text-xs text-gray-400">원</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <select
                      defaultValue={pol.product_type}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none"
                    >
                      <option>전체</option>
                      <option>MNP</option>
                      <option>재가입</option>
                      <option>기기변경</option>
                    </select>
                  </td>
                  <td className="py-2.5 px-3">
                    <input type="checkbox" defaultChecked={pol.is_active} className="rounded accent-pink-500" />
                  </td>
                  <td className="py-2.5 px-3">
                    <button className="text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-gray-400 mt-3">
          ※ 계산방식 "최종구간일괄": 정산확정 건수 기준 해당 구간 단가를 전체 건에 일괄 적용합니다.
        </p>
      </SectionCard>
    </div>
  );
}
