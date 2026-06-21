// ============================================================
// reportFormatService — 카톡 보고문 포맷 생성
// ============================================================
import type { DailyReportData, DailyReportLog } from './reportAggregationService';

// 고객명 마스킹 (박민규 → 박**, 김 → 김**)
export function maskCustomerName(name: string | null | undefined): string {
  if (!name) return '고객';
  if (name.length <= 1) return name + '**';
  return name[0] + '**';
}

// 날짜 포맷 (2026-06-21 → 2026.06.21)
function formatDate(date: string): string {
  return date.replace(/-/g, '.');
}

// 채널 표시명
function channelLabel(channel: string | null): string {
  if (!channel) return '-';
  const map: Record<string, string> = {
    meta: '메타', dogmaru: '도그마루', udak: '유닥',
  };
  return map[channel] ?? channel;
}

// 개통완료건 한 줄 포맷
function formatActivationLine(log: DailyReportLog, idx: number): string {
  const parts = [
    log.staff_name,
    channelLabel(log.channel),
    maskCustomerName(log.customer_name),
    log.next_status ?? '-',
    log.memo ?? '-',
  ];
  return `${idx + 1}. ${parts.join(' / ')}`;
}

// 진행예정건 한 줄 포맷
function formatProgressLine(log: DailyReportLog, idx: number): string {
  const parts = [
    log.staff_name,
    channelLabel(log.channel),
    maskCustomerName(log.customer_name),
    log.next_status ?? '진행중',
    log.memo ?? '-',
  ];
  return `${idx + 1}. ${parts.join(' / ')}`;
}

// 카톡 보고문 전체 생성
export function formatDailyKakaoReport(data: DailyReportData, teamName = '온라인 마케팅팀'): string {
  const { date, summary, activationLogs, progressLogs, failReasons, staffSummaries } = data;
  const lines: string[] = [];

  lines.push(`■ ${formatDate(date)} ${teamName} 일일 업무보고`);
  lines.push('');
  lines.push('[전체 요약]');
  lines.push(`- 통화시도: ${summary.call_attempt}건`);
  lines.push(`- 연결완료: ${summary.call_connected}건`);
  lines.push(`- 부재: ${summary.absent}건`);
  lines.push(`- 재케어 처리: ${summary.recare}건`);
  lines.push(`- 실패: ${summary.failed}건`);
  lines.push(`- 상담성공: ${summary.consultation_success}건`);
  lines.push(`- 택배발송: ${summary.delivery_sent}건`);
  lines.push(`- 개통완료: ${summary.activation_completed}건`);

  lines.push('');
  lines.push('[개통 완료건]');
  if (activationLogs.length === 0) {
    lines.push('- 없음');
  } else {
    activationLogs.forEach((log, i) => lines.push(formatActivationLine(log, i)));
  }

  lines.push('');
  lines.push('[진행 예정건]');
  if (progressLogs.length === 0) {
    lines.push('- 없음');
  } else {
    progressLogs.forEach((log, i) => lines.push(formatProgressLine(log, i)));
  }

  lines.push('');
  lines.push('[실패 요약]');
  if (failReasons.length === 0) {
    lines.push('- 없음');
  } else {
    failReasons.forEach((f) => lines.push(`- ${f.reason}: ${f.count}건`));
  }

  lines.push('');
  lines.push('[담당자별]');
  if (staffSummaries.length === 0) {
    lines.push('- 데이터 없음');
  } else {
    staffSummaries.forEach((s) => {
      lines.push(
        `- ${s.display_name}: 시도 ${s.call_attempt} / 연결 ${s.call_connected} / 부재 ${s.absent} / 재케어 ${s.recare} / 실패 ${s.failed} / 상담성공 ${s.consultation_success} / 개통완료 ${s.activation_completed}`
      );
    });
  }

  return lines.join('\n');
}

// 클립보드 복사
export async function copyDailyReportToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
