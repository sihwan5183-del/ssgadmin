import ExcelJS from "exceljs";

export interface InquiryExcelProfile {
  display_name: string;
  store: string | null;
}

export interface InquiryExcelMemo {
  content: string;
  created_at: string;
}

export async function exportInquiriesToExcel(
  rows: Array<{
    id: string;
    inquiry_date: string;
    channel: string;
    customer_name: string | null;
    phone: string | null;
    content: string | null;
    manager: string | null;
    status: string;
    created_by: string;
  }>,
  latestMemos: Record<string, InquiryExcelMemo>,
  profilesMap: Record<string, InquiryExcelProfile>,
  fileName?: string,
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("인입현황");

  // 컬럼 정의
  worksheet.columns = [
    { header: "날짜", key: "date", width: 14 },
    { header: "매장명", key: "store", width: 14 },
    { header: "작성자", key: "author", width: 12 },
    { header: "인입채널", key: "channel", width: 12 },
    { header: "고객명", key: "customer", width: 12 },
    { header: "연락처", key: "phone", width: 16 },
    { header: "상담내용(히스토리)", key: "content", width: 50 },
    { header: "진행상태", key: "status", width: 12 },
  ];

  // 헤더 스타일
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF3B82F6" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF1D4ED8" } },
    };
  });
  headerRow.height = 28;

  // display_name → profile 역조회 맵
  const nameToProfile = new Map<string, InquiryExcelProfile>();
  Object.values(profilesMap).forEach((p) => {
    if (p.display_name) nameToProfile.set(p.display_name, p);
  });

  // 데이터 행 추가
  rows.forEach((r) => {
    const memo = latestMemos[r.id];
    const authorProfile = profilesMap[r.created_by];
    const managerProfile = r.manager ? nameToProfile.get(r.manager) : null;

    const row = worksheet.addRow({
      date: r.inquiry_date,
      store: managerProfile?.store ?? "",
      author: authorProfile?.display_name ?? r.created_by.slice(0, 8),
      channel: r.channel,
      customer: r.customer_name ?? "",
      phone: r.phone ?? "",
      content: memo ? memo.content : (r.content ?? ""),
      status: r.status,
    });

    // 상담내용 줄바꿈 + 전체 셀 상단 정렬
    const contentCell = row.getCell("content");
    contentCell.alignment = { wrapText: true, vertical: "top" };

    // 나머지 셀도 상단 정렬
    row.eachCell((cell) => {
      if (cell !== contentCell) {
        cell.alignment = { vertical: "middle" };
      }
    });
  });

  // 데이터 행에 얇은 테두리 추가
  for (let i = 2; i <= worksheet.rowCount; i++) {
    worksheet.getRow(i).eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });
  }

  // 고정 폭 설정
  worksheet.properties.defaultRowHeight = 18;

  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName ?? "인입현황"}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
