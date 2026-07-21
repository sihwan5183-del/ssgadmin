// 고객 상세(비마스킹 PII) 열람 중 화면 전체에 열람자·시각 워터마크를 깔아
// 캡처 유출 시 추적이 가능하게 하는 억지력 컴포넌트.
// pointer-events-none 이라 클릭/스크롤 등 조작에는 영향 없음.
import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function PiiWatermark({ name }: { name?: string | null }) {
  const { user } = useAuth();

  const label = useMemo(() => {
    const stamp = new Date().toLocaleString('ko-KR', {
      year: '2-digit', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
    return [name, user?.email, stamp].filter(Boolean).join(' · ');
  }, [name, user?.email]);

  if (!label) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[9999] select-none overflow-hidden">
      <div className="absolute -inset-[60%] flex flex-wrap content-start gap-x-16 gap-y-20 -rotate-[24deg]">
        {Array.from({ length: 160 }).map((_, i) => (
          <span
            key={i}
            className="whitespace-nowrap text-[13px] font-semibold tracking-wide text-slate-900/[0.07]"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
