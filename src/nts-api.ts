import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import {
  NTS_API_BASE_URL,
  FETCH_TIMEOUT_MS,
  BUSINESS_STATUS_MAP,
  TAX_TYPE_MAP,
  getApiKey,
  type NtsStatusItem,
  type NtsStatusResponse,
  type NtsValidateItem,
  type NtsValidateResponse,
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
// 국세청 API 호출
// ============================================================

export async function callNtsApi(
  endpoint: string,
  body: object
): Promise<NtsStatusResponse | NtsValidateResponse> {
  const apiKey = getApiKey();
  const url = `${NTS_API_BASE_URL}/${endpoint}?serviceKey=${encodeURIComponent(apiKey)}`;

  const response = await safeFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[NTS] API 오류 ${response.status}: ${errorText}`);
    throw new McpError(
      ErrorCode.InternalError,
      "국세청 API 요청에 실패했습니다."
    );
  }

  return response.json() as Promise<NtsStatusResponse | NtsValidateResponse>;
}

// ============================================================
// 결과 포맷팅
// ============================================================

export function formatStatusResult(data: NtsStatusItem[]): string {
  if (!data || data.length === 0) {
    return "조회 결과가 없습니다.";
  }

  return data
    .map((item, index) => {
      const statusName =
        BUSINESS_STATUS_MAP[item.b_stt_cd] ?? item.b_stt ?? "알 수 없음";
      const taxTypeName =
        TAX_TYPE_MAP[item.tax_type_cd] ?? item.tax_type ?? "알 수 없음";

      let result = `\n[${index + 1}] 사업자등록번호: ${item.b_no}`;
      result += `\n    사업자상태: ${statusName} (코드: ${item.b_stt_cd})`;
      result += `\n    과세유형: ${taxTypeName}`;

      if (item.end_dt) {
        result += `\n    폐업일자: ${item.end_dt}`;
      }
      if (item.utcc_yn) {
        result += `\n    단위과세전환여부: ${item.utcc_yn === "Y" ? "예" : "아니오"}`;
      }
      if (item.tax_type_change_dt) {
        result += `\n    과세유형전환일자: ${item.tax_type_change_dt}`;
      }
      if (item.invoice_apply_dt) {
        result += `\n    세금계산서적용일자: ${item.invoice_apply_dt}`;
      }

      return result;
    })
    .join("\n");
}

export function formatValidateResult(data: NtsValidateItem[]): string {
  if (!data || data.length === 0) {
    return "조회 결과가 없습니다.";
  }

  return data
    .map((item, index) => {
      let result = `\n[${index + 1}] 사업자등록번호: ${item.b_no}`;
      result += `\n    진위확인결과: ${item.valid === "01" ? "일치" : "불일치"}`;

      if (item.valid_msg) {
        result += `\n    상세메시지: ${item.valid_msg}`;
      }

      if (item.request_param) {
        const req = item.request_param;
        result += `\n    --- 요청 정보 ---`;
        if (req.b_nm) result += `\n    상호: ${req.b_nm}`;
        if (req.p_nm) result += `\n    대표자명: ${req.p_nm}`;
        if (req.start_dt) result += `\n    개업일자: ${req.start_dt}`;
      }

      return result;
    })
    .join("\n");
}
