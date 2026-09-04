import { useReservationCategory, type ReservationCategory } from '@/hooks/useReservationCategory';

const OPTIONS: { value: ReservationCategory; label: string }[] = [
  { value: 'foldable', label: '폴더블' },
  { value: 'iphone18', label: '아이폰18' },
];

/**
 * 사전예약 카테고리(폴더블 / 아이폰18) 전환 토글.
 * useReservationCategory와 함께 모든 사전예약 화면 상단에 동일하게 배치합니다.
 */
export function ReservationCategoryToggle() {
  const { category, setCategory } = useReservationCategory();
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setCategory(opt.value)}
          className={`text-xs px-3 py-1.5 rounded-md font-bold transition-colors ${
            category === opt.value
              ? 'bg-pink-500 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
