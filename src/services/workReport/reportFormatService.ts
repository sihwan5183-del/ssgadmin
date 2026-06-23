// ============================================================
// reportFormatService — 카톡 보고문 포맷 생성 (채널별 분리)
// ============================================================
import type { DailyReportData, DailyReportLog, ChannelSummary } from './reportAggregationService';
import { CHANNEL_STATUS_ORDER } from './reportAggregationService';

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

// 채널별 요약 한 블록 — next_status 원본값 기준
function formatChannelBlock(cs: ChannelSummary): string {
  const lines: string[] = [];
  lines.push(`[${cs.label}]`);
  const order = CHANNEL_STATUS_ORDER[cs.channel] ?? [];
  // 정해진 순서대로 출력 (0건도 표시)
  order.forEach(status => {
    const count = cs.statusCounts[status] ?? 0;
    lines.push(`- ${status}: ${count}건`);
  });
  // 순서에 없는 상태값도 추가 출력
  Object.entries(cs.statusCounts).forEach(([status, count]) => {
    if (!order.includes(status)) {
      lines.push(`- ${status}: ${count}건`);
    }
  });
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

  // 담당자별 — 채널별 상태값 기준
  lines.push('');
  lines.push('[담당자별]');
  if (staffSummaries.length === 0) {
    lines.push('- 데이터 없음');
  } else {
    staffSummaries.forEach((s) => {
      lines.push('');
      lines.push(`▶ ${s.display_name}`);
      const chOrder = ['meta', 'dogmaru', 'udak', 'other'];
      const chLabels: Record<string, string> = { meta: '메타', dogmaru: '도그마루', udak: '유닥', other: '기타인입' };
      chOrder.forEach(ch => {
        const counts = s.channelStatusCounts[ch];
        if (!counts || Object.keys(counts).length === 0) return;
        const statusOrder = CHANNEL_STATUS_ORDER[ch] ?? [];
        const parts: string[] = [];
        // 정해진 순서대로
        statusOrder.forEach(st => {
          const c = counts[st] ?? 0;
          if (c > 0) parts.push(`${st} ${c}`);
        });
        // 순서에 없는 것도
        Object.entries(counts).forEach(([st, c]) => {
          if (!statusOrder.includes(st) && c > 0) parts.push(`${st} ${c}`);
        });
        if (parts.length > 0) {
          lines.push(`  [${chLabels[ch]}] ${parts.join(' / ')}`);
        }
      });
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
