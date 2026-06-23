// ============================================================
// reportFormatService — 카톡 보고문 포맷 생성 (채널별 분리)
// ============================================================
import type { DailyReportData, DailyReportLog, ChannelSummary } from './reportAggregationService';

export function maskCustomerName(name: string | null | undefined): string {
  if (!name) return '고객';
  if (name.length === 1) return name + '*';
  if (name.length === 2) return name[0] + '*';
  return name[0] + '*' + name[name.length - 1];
}

function formatDate(date: string): string {
  return date.replace(/-/g, '.');
}

function channelLabel(channel: string | null): string {
  if (!channel) return '-';
  const map: Record<string, string> = {
    meta: '메타', dogmaru: '도그마루', udak: '유닥',
  };
  return map[channel] ?? channel;
}

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

// 채널별 요약 한 블록
function formatChannelBlock(cs: ChannelSummary): string {
  const lines: string[] = [];
  lines.push(`[${cs.label}]`);

  // 채널별로 의미있는 항목만 출력
  if (cs.channel === 'meta') {
    lines.push(`- 케어(시도): ${cs.call_attempt}건`);
    lines.push(`- 부재: ${cs.absent}건`);
    lines.push(`- 재케어: ${cs.recare}건`);
    lines.push(`- 취소(실패): ${cs.failed}건`);
    lines.push(`- 개통완료: ${cs.activation_completed}건`);
  } else if (cs.channel === 'dogmaru') {
    lines.push(`- 해피콜 시도: ${cs.call_attempt}건`);
    lines.push(`- 해피콜O(연결): ${cs.call_connected}건`);
    lines.push(`- 해피콜X(부재): ${cs.absent}건`);
    lines.push(`- 재케어: ${cs.recare}건`);
    lines.push(`- 영업O(상담성공): ${cs.consultation_success}건`);
    lines.push(`- 영업X(실패): ${cs.failed}건`);
    lines.push(`- 개통완료: ${cs.activation_completed}건`);
  } else if (cs.channel === 'udak') {
    lines.push(`- 부재: ${cs.absent}건`);
    lines.push(`- 재케어: ${cs.recare}건`);
    lines.push(`- 성공(상담성공): ${cs.consultation_success}건`);
    lines.push(`- 실패: ${cs.failed}건`);
    lines.push(`- 택배발송: ${cs.delivery_sent}건`);
    lines.push(`- 개통완료: ${cs.activation_completed}건`);
  } else {
    lines.push(`- 부재: ${cs.absent}건`);
    lines.push(`- 재케어: ${cs.recare}건`);
    lines.push(`- 성공: ${cs.consultation_success}건`);
    lines.push(`- 실패: ${cs.failed}건`);
    lines.push(`- 개통완료: ${cs.activation_completed}건`);
  }
  return lines.join('\n');
}

// 카톡 보고문 전체 생성
export function formatDailyKakaoReport(data: DailyReportData, teamName = '온라인 마케팅팀'): string {
  const { date, summary, channelSummaries, activationLogs, progressLogs, failReasons, staffSummaries } = data;
  const lines: string[] = [];

  lines.push(`■ ${formatDate(date)} ${teamName} 일일 업무보고`);
  lines.push('');

  // 전체 요약
  lines.push('[전체 요약]');
  lines.push(`- 통화시도: ${summary.call_attempt}건`);
  lines.push(`- 연결완료: ${summary.call_connected}건`);
  lines.push(`- 부재: ${summary.absent}건`);
  lines.push(`- 재케어 처리: ${summary.recare}건`);
  lines.push(`- 실패: ${summary.failed}건`);
  lines.push(`- 상담성공: ${summary.consultation_success}건`);
  lines.push(`- 택배발송: ${summary.delivery_sent}건`);
  lines.push(`- 개통완료: ${summary.activation_completed}건`);

  // 채널별 분리 요약
  if (channelSummaries.length > 0) {
    lines.push('');
    lines.push('[채널별 요약]');
    channelSummaries.forEach(cs => {
      lines.push('');
      lines.push(formatChannelBlock(cs));
    });
  }

  // 개통 완료건
  lines.push('');
  lines.push('[개통 완료건]');
  if (activationLogs.length === 0) {
    lines.push('- 없음');
  } else {
    activationLogs.forEach((log, i) => lines.push(formatActivationLine(log, i)));
  }

  // 진행 예정건
  lines.push('');
  lines.push('[진행 예정건]');
  if (progressLogs.length === 0) {
    lines.push('- 없음');
  } else {
    progressLogs.forEach((log, i) => lines.push(formatProgressLine(log, i)));
  }

  // 실패 요약
  lines.push('');
  lines.push('[실패 요약]');
  if (failReasons.length === 0) {
    lines.push('- 없음');
  } else {
    failReasons.forEach((f) => lines.push(`- ${f.reason}: ${f.count}건`));
  }

  // 담당자별
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

export async function copyDailyReportToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
