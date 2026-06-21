// ============================================================
// staffDisplayService — 담당자 표시명 공통 서비스
// profiles.display_name 기준으로 이메일 → 이름 변환
// ============================================================
import { supabase } from '@/integrations/supabase/client';

// staff_id → display_name 캐시
const displayNameCache = new Map<string, string>();

// 이메일인지 판단
function isEmail(str: string): boolean {
  return str.includes('@');
}

// 이메일에서 앞부분만 추출 (fallback)
function emailToShortName(email: string): string {
  return email.split('@')[0];
}

// 단일 사용자 표시명 조회
export async function resolveStaffDisplayName(staffId: string, fallback?: string): Promise<string> {
  if (displayNameCache.has(staffId)) {
    return displayNameCache.get(staffId)!;
  }

  const { data } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('user_id', staffId)
    .single();

  const name = data?.display_name ?? (
    fallback
      ? isEmail(fallback) ? emailToShortName(fallback) : fallback
      : '미지정'
  );

  displayNameCache.set(staffId, name);
  return name;
}

// 여러 staff_id 한 번에 조회 → Map 반환
export async function resolveStaffDisplayNames(
  staffIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(staffIds)];
  const uncached = unique.filter((id) => !displayNameCache.has(id));

  if (uncached.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', uncached);

    (data ?? []).forEach((p) => {
      displayNameCache.set(p.user_id, p.display_name);
    });

    // 조회 안 된 ID는 '미지정' 처리
    uncached.forEach((id) => {
      if (!displayNameCache.has(id)) {
        displayNameCache.set(id, '미지정');
      }
    });
  }

  const result = new Map<string, string>();
  unique.forEach((id) => result.set(id, displayNameCache.get(id)!));
  return result;
}

// staff_name 필드가 이메일이면 변환, 아니면 그대로
export function normalizeStaffName(staffName: string, resolvedName?: string): string {
  if (resolvedName) return resolvedName;
  if (isEmail(staffName)) return emailToShortName(staffName);
  return staffName;
}

// 캐시 초기화 (필요 시)
export function clearDisplayNameCache(): void {
  displayNameCache.clear();
}
