// ============================================================
// CRM 접수 — 상세/수정 모달
// ============================================================
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStaff } from '@/hooks/useDashboardStaff';
import { useRole } from '@/hooks/useRole';
import { formatPhone } from '@/lib/phoneFormat';

const STATUS_OPTIONS = ['신규 접수','부재','재케어','성공','실패','개통완료'];
const CARRIER_OPTIONS = ['LG U+','SKT','KT','알뜰폰'];
const CAPACITY_OPTIONS = ['256GB','512GB','1TB'];
const GROUP_OPTIONS = ['동부','북부','중부','강동'];

interface Props { leadId: string; onClose: () => void; onDone: () => void; }

export function CrmDetailModal({ leadId, onClose, onDone }: Props) {
  const { user } = useAuth();
  const { staff } = useDashboardStaff();
  const { isAdmin } = useRole();

  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [carrier, setCarrier] = useState('');
  const [status, setStatus] = useState('신규 접수');
  const [assignedTo, setAssignedTo] = useState('');
  const [crmGroup, setCrmGroup] = useState('');
  const [crmBranch, setCrmBranch] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [product, setProduct] = useState('');
  const [modelName, setModelName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [color, setColor] = useState('');
  const [benefit, setBenefit] = useState('');
  const [inquiryContent, setInquiryContent] = useState('');
  const [address, setAddress] = useState('');
  const [memo, setMemo] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from('leads').select('*').eq('id', leadId).single();
      if (data) {
        setRow(data);
        setName(data.customer_name ?? data.name ?? '');
        setBirth((data as any).birth ?? '');
        setPhone(data.customer_phone ?? data.phone ?? '');
        setCarrier(data.current_carrier ?? '');
        setStatus(data.status ?? '신규 접수');
        setAssignedTo(data.assigned_to ?? '');
        setCrmGroup((data as any).crm_group ?? '');
        setCrmBranch((data as any).crm_branch ?? '');
        setProduct(data.desired_product ?? '');
        setModelName((data as any).model_name ?? '');
        setCapacity(data.desired_device ?? '');
        setColor((data as any).product_color ?? '');
        setBenefit((data as any).product_benefit ?? '');
        setInquiryContent((data as any).inquiry_content ?? '');
        setAddress((data as any).address ?? '');
        setMemo(data.memo ?? '');
      }
      setLoading(false);
    };
    load();
    supabase.from('field_options').select('value').eq('field', 'product').eq('active', true).order('sort_order')
      .then(({ data }) => setProducts((data ?? []).map((d: any) => d.value)));
  }, [leadId]);

  useEffect(() => {
    if (!crmGroup) { setBranches([]); return; }
    supabase.from('crm_branches').select('branch_name').eq('group_name', crmGroup).eq('active', true)
      .order('sort_order')
      .then(({ data }) => setBranches((data ?? []).map((d: any) => d.branch_name)));
  }, [crmGroup]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('leads').update({
        customer_name: name.trim(),
        name: name.trim(),
        customer_phone: phone.trim(),
        phone: phone.trim(),
        birth: birth.trim() || null,
        current_carrier: carrier || null,
        desired_product: product || null,
        desired_device: capacity || null,
        model_name: modelName.trim() || null,
        status,
        assigned_to: assignedTo || null,
        crm_group: crmGroup || null,
        crm_branch: crmBranch || null,
        address: address.trim() || null,
        product_color: color.trim() || null,
        product_benefit: benefit || null,
        inquiry_content: inquiryContent.trim() || null,
        memo: memo.trim() || null,
      } as any).eq('id', leadId);
      if (error) throw error;
      toast.success('저장되었습니다');
      onDone();
    } catch (e: any) {
      toast.error('저장 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const { error } = await supabase.from('leads')
      .update({ deleted_at: new Date().toISOString() } as any).eq('id', leadId);
    if (error) { toast.error('삭제 실패'); return; }
    toast.success('삭제되었습니다');
    onDone();
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">CRM 접수 상세</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">로딩 중...</div>
        ) : (
          <div className="space-y-5 pt-2">
            {/* 기본 정보 */}
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-2">기본 정보</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">고객명</label>
                  <Input value={name} onChange={e => setName(e.target.value)} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">생년월일</label>
                  <Input value={birth} onChange={e => setBirth(e.target.value)} maxLength={8} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">연락처</label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">통신사</label>
                  <Select value={carrier || '_none_'} onValueChange={v => setCarrier(v === '_none_' ? '' : v)}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">선택 안함</SelectItem>
                      {CARRIER_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 지부/매장 */}
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-2">지부 / 매장</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">지부</label>
                  <Select value={crmGroup || '_none_'} onValueChange={v => setCrmGroup(v === '_none_' ? '' : v)}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">선택 안함</SelectItem>
                      {GROUP_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">매장</label>
                  <Select value={crmBranch || '_none_'} onValueChange={v => setCrmBranch(v === '_none_' ? '' : v)} disabled={!crmGroup}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">선택 안함</SelectItem>
                      {branches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 상품 정보 */}
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-2">상품 정보</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">문의 상품</label>
                  <Select value={product || '_none_'} onValueChange={v => setProduct(v === '_none_' ? '' : v)}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">선택 안함</SelectItem>
                      {products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">제품명 (모델명)</label>
                  <Input value={modelName} onChange={e => setModelName(e.target.value)} placeholder="예) 갤럭시 S25 Ultra" className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">용량</label>
                  <Select value={capacity || '_none_'} onValueChange={v => setCapacity(v === '_none_' ? '' : v)}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">선택 안함</SelectItem>
                      {CAPACITY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">컬러</label>
                  <Input value={color} onChange={e => setColor(e.target.value)} placeholder="예) 티타늄 블루" className="text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">혜택 메모 <span className="text-gray-400">(워치/탭/티비프리 등 자유 입력)</span></label>
                  <Input value={benefit} onChange={e => setBenefit(e.target.value)} placeholder="예) 워치7 + 갤탭S10 + 티비프리" className="text-sm" />
                </div>
              </div>
            </div>

            {/* 담당/상태 */}
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-2">담당 / 상태</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">담당자</label>
                  <Select value={assignedTo || '_none_'} onValueChange={v => setAssignedTo(v === '_none_' ? '' : v)}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">선택 안함</SelectItem>
                      {staff.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.display_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">상태</label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 상세 정보 */}
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-2">상세 정보</div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">문의 내용</label>
                  <Textarea value={inquiryContent} onChange={e => setInquiryContent(e.target.value)} className="text-sm resize-none" rows={2} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">주소</label>
                  <Input value={address} onChange={e => setAddress(e.target.value)} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">메모</label>
                  <Textarea value={memo} onChange={e => setMemo(e.target.value)} className="text-sm resize-none" rows={2} />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              {isAdmin && (
                <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50"
                  onClick={() => setConfirmDelete(true)}>삭제</Button>
              )}
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>취소</Button>
              <Button className="flex-1 bg-pink-500 hover:bg-pink-600 text-white"
                onClick={handleSave} disabled={saving}>
                {saving ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        )}

        {/* 삭제 확인 */}
        {confirmDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
            onClick={() => setConfirmDelete(false)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="font-bold text-sm mb-2">정말 삭제하시겠어요?</div>
              <div className="text-xs text-gray-500 mb-4">삭제된 데이터는 복구할 수 없습니다.</div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>취소</Button>
                <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete}>삭제</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


