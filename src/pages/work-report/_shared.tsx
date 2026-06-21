// 영업 활동 리포트 공통 헤더 컴포넌트
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface WorkReportHeaderProps {
  title: string;
  description?: string;
  rightSlot?: ReactNode;
  className?: string;
}

export function WorkReportHeader({ title, description, rightSlot, className }: WorkReportHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-1 mb-5', className)}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {rightSlot && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">{rightSlot}</div>
        )}
      </div>
    </div>
  );
}

// 공통 KPI 카드
interface KpiCardProps {
  label: string;
  value: number | string;
  sub?: string;
  color?: 'pink' | 'blue' | 'green' | 'orange' | 'red' | 'yellow' | 'indigo' | 'gray';
  className?: string;
}

const colorMap: Record<string, string> = {
  pink: 'bg-pink-50 border-pink-200 text-pink-700',
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  green: 'bg-green-50 border-green-200 text-green-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
  red: 'bg-red-50 border-red-200 text-red-700',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  gray: 'bg-gray-50 border-gray-200 text-gray-600',
};

export function KpiCard({ label, value, sub, color = 'gray', className }: KpiCardProps) {
  return (
    <div className={cn('rounded-xl border p-4 flex flex-col gap-1 min-w-[100px]', colorMap[color], className)}>
      <div className="text-xs font-medium opacity-75">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-[10px] opacity-60 leading-tight">{sub}</div>}
    </div>
  );
}

// 공통 섹션 카드 래퍼
interface SectionCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  rightSlot?: ReactNode;
}

export function SectionCard({ title, children, className, rightSlot }: SectionCardProps) {
  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 shadow-sm', className)}>
      {title && (
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          {rightSlot}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

// 공통 배지
interface BadgeProps {
  children: ReactNode;
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'default';
}

const badgeVariantMap: Record<string, string> = {
  success: 'bg-green-100 text-green-700',
  danger: 'bg-red-100 text-red-700',
  warning: 'bg-yellow-100 text-yellow-700',
  info: 'bg-blue-100 text-blue-700',
  default: 'bg-gray-100 text-gray-600',
};

export function WRBadge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold', badgeVariantMap[variant])}>
      {children}
    </span>
  );
}

// 공통 필터 버튼 그룹
interface FilterButtonsProps {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}

export function FilterButtons({ options, value, onChange }: FilterButtonsProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            'px-3 py-1 text-xs rounded-md font-medium transition-colors',
            value === opt
              ? 'bg-white text-pink-600 shadow-sm font-semibold'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
