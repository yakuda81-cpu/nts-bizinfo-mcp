import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import {
  KASI_API_BASE_URL,
  FETCH_TIMEOUT_MS,
  KASI_NUM_OF_ROWS,
  HOLIDAY_ENDPOINTS,
  HOLIDAY_TYPE_NAMES,
  getApiKey,
  type HolidayType,
  type KasiResponse,
  type KasiHolidayItem,
} from "./types.js";

// ============================================================
// 안전한 fetch (타임아웃 + redirect 차단)
// ============================================================

async function safeFetch(
  url: string,
  options: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: "error",
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// 천문연구원 API 호출
// ============================================================

async function callKasiApi(
  endpoint: string,
  year: number,
  month?: number
): Promise<KasiResponse> {
  const apiKey = getApiKey();

  let url = `${KASI_API_BASE_URL}/${endpoint}?serviceKey=${encodeURIComponent(apiKey)}&solYear=${year}&numOfRows=${KASI_NUM_OF_ROWS}&_type=json`;

  if (month) {
    const monthStr = month.toString().padStart(2, "0");
    url += `&solMonth=${monthStr}`;
  }

  const response = await safeFetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[KASI] API 오류 ${response.status}: ${errorText}`);
    throw new McpError(
      ErrorCode.InternalError,
      "천문연구원 API 요청에 실패했습니다."
    );
  }

  const text = await response.text();

  if (text.startsWith("<?xml") || text.startsWith("<")) {
    throw new McpError(
      ErrorCode.InternalError,
      "API가 XML 응답을 반환했습니다. JSON 응답을 기대했습니다."
    );
  }

  return JSON.parse(text) as KasiResponse;
}

// ============================================================
// 결과 포맷팅
// ============================================================

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

function formatHolidayItem(item: KasiHolidayItem, index: number): string {
  let result = `\n[${index + 1}] ${item.dateName}`;
  result += `\n    날짜: ${formatDate(String(item.locdate))}`;
  if (item.isHoliday) {
    result += `\n    공휴일 여부: ${item.isHoliday === "Y" ? "예" : "아니오"}`;
  }
  return result;
}

export function formatHolidayResult(
  data: KasiResponse,
  typeName: string
): string {
  const response = data?.response;
  if (!response) {
    return "응답 데이터가 없습니다.";
  }

  const header = response.header;
  if (header?.resultCode !== "00") {
    return `API 오류: ${header?.resultMsg ?? "알 수 없는 오류"}`;
  }

  const body = response.body;
  const totalCount = body?.totalCount ?? 0;

  if (totalCount === 0) {
    return `해당 기간에 ${typeName} 정보가 없습니다.`;
  }

  const items = body?.items?.item;
  if (!items) {
    return `해당 기간에 ${typeName} 정보가 없습니다.`;
  }

  const itemList: KasiHolidayItem[] = Array.isArray(items) ? items : [items];

  let result = `총 ${totalCount}건\n`;
  itemList.forEach((item, index) => {
    result += formatHolidayItem(item, index);
  });

  return result;
}

// ============================================================
// 여러 달 특일 정보 조회
// ============================================================

export async function getHolidaysForMonths(
  type: HolidayType,
  year: number,
  startMonth: number,
  monthCount: number
): Promise<string> {
  const endpoint = HOLIDAY_ENDPOINTS[type];
  const typeName = HOLIDAY_TYPE_NAMES[type];
  const allItems: KasiHolidayItem[] = [];
  const errors: string[] = [];

  for (let i = 0; i < monthCount; i++) {
    let targetMonth = startMonth + i;
    let targetYear = year;

    while (targetMonth > 12) {
      targetMonth -= 12;
      targetYear += 1;
    }

    try {
      const data = await callKasiApi(endpoint, targetYear, targetMonth);
      const response = data?.response;

      if (response?.header?.resultCode === "00") {
        const items = response?.body?.items?.item;
        if (items) {
          const itemList: KasiHolidayItem[] = Array.isArray(items)
            ? items
            : [items];
          allItems.push(...itemList);
        }
      }
    } catch (error) {
      console.error(`[KASI] ${targetYear}년 ${targetMonth}월 조회 오류:`, error);
      errors.push(`${targetYear}년 ${targetMonth}월: 조회에 실패했습니다.`);
    }
  }

  if (allItems.length === 0 && errors.length > 0) {
    return `조회 중 오류 발생:\n${errors.join("\n")}`;
  }

  if (allItems.length === 0) {
    return `해당 기간에 ${typeName} 정보가 없습니다.`;
  }

  allItems.sort((a, b) => Number(a.locdate) - Number(b.locdate));

  let result = `## ${typeName} 조회 결과\n`;
  result += `총 ${allItems.length}건\n`;

  allItems.forEach((item, index) => {
    result += formatHolidayItem(item, index);
  });

  if (errors.length > 0) {
    result += `\n\n일부 조회 실패:\n${errors.join("\n")}`;
  }

  return result;
}
