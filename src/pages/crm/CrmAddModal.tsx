// ============================================================
// CRM 접수 — 신규 등록 모달
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

const STATUS_OPTIONS = ['신규 접수','부재','재케어','성공','실패','개통완료'];
const CARRIER_OPTIONS = ['LG U+','SKT','KT','알뜰폰'];
const CAPACITY_OPTIONS = ['256GB','512GB','1TB'];
const GROUP_OPTIONS = ['동부','북부','중부','강동'];

interface Props { open: boolean; onClose: () => void; onDone: () => void; }

export function CrmAddModal({ open, onClose, onDone }: Props) {
  const { user } = useAuth();
  const { staff } = useDashboardStaff();

  // 기본 정보
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [carrier, setCarrier] = useState('');
  const [assignedTo, setAssignedTo] = useState(user?.id ?? '');
  const [status, setStatus] = useState('신규 접수');

  // 지부/매장
  const [crmGroup, setCrmGroup] = useState('');
  const [crmBranch, setCrmBranch] = useState('');
  const [branches, setBranches] = useState<string[]>([]);

  // 상품 정보
  const [products, setProducts] = useState<string[]>([]);
  const [product, setProduct] = useState('');
  const [modelName, setModelName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [color, setColor] = useState('');
  const [benefit, setBenefit] = useState('');

  // 기타
  const [inquiryContent, setInquiryContent] = useState('');
  const [address, setAddress] = useState('');
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);

  // 상품 목록 로드
  useEffect(() => {
    supabase.from('field_options').select('value').eq('field', 'product').eq('active', true)
      .order('sort_order')
      .then(({ data }) => setProducts((data ?? []).map((d: any) => d.value)));
  }, []);

  // 지부 선택 시 매장 로드
  useEffect(() => {
    if (!crmGroup) { setBranches([]); setCrmBranch(''); return; }
    supabase.from('crm_branches').select('branch_name').eq('group_name', crmGroup).eq('active', true)
      .order('sort_order')
      .then(({ data }) => {
        setBranches((data ?? []).map((d: any) => d.branch_name));
        setCrmBranch('');
      });
  }, [crmGroup]);

  const handleSubmit = async () => {
    if (!name.trim()) return toast.error('고객명을 입력해주세요');
    if (!phone.trim()) return toast.error('연락처를 입력해주세요');

    setLoading(true);
    try {
      const { error } = await supabase.from('leads').insert({
        customer_name: name.trim(),
        name: name.trim(),
        customer_phone: phone.trim(),
        phone: phone.trim(),
        birth: birth.trim() || null,
        current_carrier: carrier || null,
        desired_product: product || null,
        status,
        source: 'crm',
        assigned_to: assignedTo || null,
        crm_group: crmGroup || null,
        crm_branch: crmBranch || null,
        address: address.trim() || null,
        product_color: color.trim() || null,
        product_benefit: benefit || null,
        inquiry_content: inquiryContent.trim() || null,
        desired_device: capacity || null,
        model_name: modelName.trim() || null,
        memo: memo.trim() || null,
        registration_date: new Date().toISOString().slice(0, 10),
      } as any);

      if (error) throw error;
      toast.success('등록되었습니다');
      onDone();
    } catch (e: any) {
      toast.error('등록 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">CRM 신규 등록</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* 기본 정보 */}
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">기본 정보</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">고객명 <span className="text-red-400">*</span></label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="홍길동" className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">생년월일</label>
                <Input value={birth} onChange={e => setBirth(e.target.value)} placeholder="예) 19900101" maxLength={8} className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">연락처 <span className="text-red-400">*</span></label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">통신사</label>
                <Select value={carrier || '_none_'} onValueChange={v => setCarrier(v === '_none_' ? '' : v)}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
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
            <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">지부 / 매장</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">지부</label>
                <Select value={crmGroup || '_none_'} onValueChange={v => setCrmGroup(v === '_none_' ? '' : v)}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="지부 선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">선택 안함</SelectItem>
                    {GROUP_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">매장</label>
                <Select value={crmBranch || '_none_'} onValueChange={v => setCrmBranch(v === '_none_' ? '' : v)} disabled={!crmGroup}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder={crmGroup ? '매장 선택' : '지부 먼저 선택'} /></SelectTrigger>
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
            <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">상품 정보</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">문의 상품</label>
                <Select value={product || '_none_'} onValueChange={v => setProduct(v === '_none_' ? '' : v)}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="상품 선택" /></SelectTrigger>
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
                  <SelectTrigger className="text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
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

          {/* 담당자 / 상태 */}
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">담당 / 상태</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">담당자</label>
                <Select value={assignedTo || '_none_'} onValueChange={v => setAssignedTo(v === '_none_' ? '' : v)}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
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

          {/* 문의내용 / 주소 / 메모 */}
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">상세 정보</div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">문의 내용</label>
                <Textarea value={inquiryContent} onChange={e => setInquiryContent(e.target.value)}
                  placeholder="고객 문의 내용" className="text-sm resize-none" rows={2} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">주소</label>
                <Input value={address} onChange={e => setAddress(e.target.value)}
                  placeholder="배송지 주소" className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">메모</label>
                <Textarea value={memo} onChange={e => setMemo(e.target.value)}
                  placeholder="기타 메모" className="text-sm resize-none" rows={2} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>취소</Button>
          <Button className="flex-1 bg-pink-500 hover:bg-pink-600 text-white"
            onClick={handleSubmit} disabled={loading}>
            {loading ? '등록 중...' : '등록'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


