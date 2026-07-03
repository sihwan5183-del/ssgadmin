// ============================================================
// 리포트 설정 — 인센 정책 DB 저장 (관리자 전용)
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
function useSupabase() { return { supabase }; }
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { WorkReportHeader, SectionCard } from './_shared';
import {
  fetchAllMonthPolicies,
  upsertIncentivePolicy,
  deleteIncentivePolicy,
  type IncentivePolicy,
} from '@/services/workReport/incentiveService';

function ToggleSetting({ label, description, defaultChecked }: {
  label: string; description?: string; defaultChecked?: boolean;
}) {
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

// ── 실패사유 관리 컴포넌트 ──────────────────────────────────
function FailReasonSettings({ userId }: { userId: string }) {
  const [reasons, setReasons] = useState<{id:string;label:string;sort_order:number;is_active:boolean}[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const { supabase } = useSupabase();

  const load = async () => {
    const { data } = await supabase.from('fail_reasons').select('*').order('sort_order');
    if (data) setReasons(data as any);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    const maxOrder = reasons.length > 0 ? Math.max(...reasons.map(r => r.sort_order)) : 0;
    await supabase.from('fail_reasons').insert({ label: newLabel.trim(), sort_order: maxOrder + 1, created_by: userId });
    setNewLabel('');
    load();
  };

  const handleToggle = async (id: string, is_active: boolean) => {
    await supabase.from('fail_reasons').update({ is_active: !is_active }).eq('id', id);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await supabase.from('fail_reasons').delete().eq('id', id);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          placeholder="새 실패 사유 입력 후 Enter"
          className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-pink-400"
        />
        <button
          onClick={handleAdd}
          disabled={!newLabel.trim()}
          className="px-4 py-2 bg-pink-500 text-white text-sm font-semibold rounded-lg hover:bg-pink-600 disabled:opacity-40"
        >
          + 추가
        </button>
      </div>
      <div className="space-y-2">
        {reasons.map((r, i) => (
          <div key={r.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${r.is_active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-50'}`}>
            <span className="text-xs text-gray-400 w-5 text-center font-mono">{i+1}</span>
            <span className={`flex-1 text-sm font-medium ${r.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{r.label}</span>
            <button
              onClick={() => handleToggle(r.id, r.is_active)}
              className={`text-xs px-2.5 py-1 rounded-lg font-semibold border transition-colors ${r.is_active ? 'bg-green-50 border-green-200 text-green-600 hover:bg-green-100' : 'bg-gray-100 border-gray-200 text-gray-400 hover:bg-gray-200'}`}
            >
              {r.is_active ? '활성' : '비활성'}
            </button>
            <button
              onClick={() => handleDelete(r.id)}
              className="text-xs px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 font-semibold"
            >
              삭제
            </button>
          </div>
        ))}
        {reasons.length === 0 && <p className="text-sm text-gray-400 text-center py-4">등록된 실패 사유가 없습니다</p>}
      </div>
      <p className="text-[11px] text-gray-400">※ 비활성화된 항목은 선택 화면에 표시되지 않습니다. 삭제 시 기존 기록에는 영향 없습니다.</p>
    </div>
  );
}

export default function ReportSettings() {
  const { user } = useAuth();
  const { isAdmin } = useRole();

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [applyMonth, setApplyMonth] = useState(currentMonth);
  const [policies, setPolicies] = useState<IncentivePolicy[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 편집용 로컬 상태
  const [editRows, setEditRows] = useState<Array<Partial<IncentivePolicy> & { _new?: boolean }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchAllMonthPolicies();
      const filtered = all.filter((p) => p.apply_month === applyMonth);
      setPolicies(filtered);
      setEditRows(filtered.map((p) => ({ ...p })));
    } catch (e: any) {
      toast.error('정책 조회 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [applyMonth]);

  useEffect(() => { load(); }, [load]);

  const handleAddRow = () => {
    setEditRows((prev) => [
      ...prev,
      { _new: true, apply_month: applyMonth, product_type: '전체', calc_method: '최종구간일괄', range_start: 1, range_end: null, unit_price: 0, is_active: true },
    ]);
  };

  const handleSaveAll = async () => {
    if (!user) return;
    setSaving(true);
    try {
      for (const row of editRows) {
        await upsertIncentivePolicy({
          ...row,
          apply_month: applyMonth,
          created_by: user.id,
        } as any);
      }
      toast.success('인센 정책이 저장되었습니다.');
      await load();
    } catch (e: any) {
      toast.error('저장 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 구간을 삭제하시겠습니까?')) return;
    try {
      await deleteIncentivePolicy(id);
      toast.success('삭제되었습니다.');
      await load();
    } catch (e: any) {
      toast.error('삭제 실패: ' + e.message);
    }
  };

  const updateRow = (idx: number, field: string, value: any) => {
    setEditRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center text-gray-400">
          <div className="text-lg font-semibold mb-1">접근 권한 없음</div>
          <div className="text-sm">리포트 설정은 관리자만 접근할 수 있습니다.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <WorkReportHeader
        title="리포트 설정"
        description="업무량 인정 기준, 인센 정책을 관리자가 직접 설정합니다."
        rightSlot={
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs bg-pink-500 hover:bg-pink-600 text-white rounded-lg px-4 py-2 font-medium transition-colors disabled:opacity-50"
          >
            <Save className="size-3.5" />{saving ? '저장 중...' : '전체 저장'}
          </button>
        }
      />

      {/* 업무량 인정 기준 (로컬 설정 — 추후 DB 연결) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="업무량 인정 기준">
          {[
            { label: '동일 고객 동일 행동 중복 제한', sub: '10분 이내 중복 시 미인정' },
            { label: '부재 인정 횟수 (일 최대 3회)' },
            { label: '문자발송 인정 횟수 (일 최대 2회)' },
          ].map((item) => (
            <div key={item.label} className="flex justify-between items-center py-3 border-b border-gray-50 last:border-0">
              <div>
                <div className="text-sm font-medium text-gray-800">{item.label}</div>
                {item.sub && <div className="text-xs text-gray-400 mt-0.5">{item.sub}</div>}
              </div>
              <span className="text-xs text-gray-400 bg-gray-100 rounded-lg px-2 py-1">적용 중</span>
            </div>
          ))}
        </SectionCard>

        {/* 보고서 양식 설정 */}
        <SectionCard title="보고서 양식">
          <ToggleSetting label="고객명 마스킹" description="박민규 → 박*규 형태" defaultChecked={true} />
          <ToggleSetting label="연락처 표시" description="보고서에 연락처 포함" defaultChecked={false} />
          <ToggleSetting label="실패 사유 포함" defaultChecked={true} />
          <ToggleSetting label="담당자별 요약 포함" defaultChecked={true} />
          <ToggleSetting label="성공건 상세 포함" defaultChecked={true} />
          <ToggleSetting label="진행예정건 포함" defaultChecked={true} />
        </SectionCard>
      </div>

      {/* 인센 정책 — DB 연결 */}
      <SectionCard
        title="인센 정책"
        rightSlot={
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={applyMonth}
              onChange={(e) => setApplyMonth(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
            />
            <button
              onClick={handleAddRow}
              className="flex items-center gap-1 text-xs bg-pink-500 hover:bg-pink-600 text-white rounded-lg px-3 py-1.5 font-medium transition-colors"
            >
              <Plus className="size-3" />구간 추가
            </button>
          </div>
        }
      >
        {loading ? (
          <div className="py-8 text-center text-sm text-gray-400">로딩 중...</div>
        ) : (
          <>
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
                  {editRows.map((row, idx) => (
                    <tr key={row.id ?? `new-${idx}`} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          value={row.range_start ?? ''}
                          onChange={(e) => updateRow(idx, 'range_start', Number(e.target.value))}
                          className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-pink-300"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          value={row.range_end ?? ''}
                          placeholder="이상"
                          onChange={(e) => updateRow(idx, 'range_end', e.target.value ? Number(e.target.value) : null)}
                          className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-pink-300"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={row.unit_price ?? ''}
                            onChange={(e) => updateRow(idx, 'unit_price', Number(e.target.value))}
                            className="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-pink-300"
                          />
                          <span className="text-xs text-gray-400">원</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={row.product_type ?? '전체'}
                          onChange={(e) => updateRow(idx, 'product_type', e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none"
                        >
                          {['전체', 'MNP', '재가입', '기기변경'].map((o) => <option key={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={row.is_active ?? true}
                          onChange={(e) => updateRow(idx, 'is_active', e.target.checked)}
                          className="rounded accent-pink-500"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        {row.id && (
                          <button
                            onClick={() => handleDelete(row.id!)}
                            className="text-gray-300 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {editRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-gray-400">
                        구간을 추가해주세요.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-gray-400 mt-3">
              ※ 계산방식 "최종구간일괄": 정산확정 건수 기준 해당 구간 단가를 전체 건에 일괄 적용합니다.
            </p>
          </>
        )}
      </SectionCard>

      {/* 실패 사유 관리 */}
      <SectionCard title="실패 사유 관리">
        <p className="text-xs text-gray-400 mb-3">잠재고객 실패 처리 시 표시될 사유 항목을 관리합니다. 추가/비활성화/삭제 가능합니다.</p>
        {user && <FailReasonSettings userId={user.id} />}
      </SectionCard>
    </div>
  );
}
