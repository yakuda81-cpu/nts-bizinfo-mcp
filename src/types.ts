import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

// ============================================================
// 상수
// ============================================================

export const NTS_API_BASE_URL =
  "https://api.odcloud.kr/api/nts-businessman/v1";
export const KASI_API_BASE_URL =
  "http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService";

export const MAX_BUSINESS_NUMBERS = 100;
export const MIN_YEAR = 1900;
export const MAX_YEAR = 2100;
export const FETCH_TIMEOUT_MS = 30_000;
export const MAX_MONTH_COUNT = 12;
export const KASI_NUM_OF_ROWS = 100;

export const BUSINESS_STATUS_MAP: Record<string, string> = {
  "01": "계속사업자",
  "02": "휴업자",
  "03": "폐업자",
};

export const TAX_TYPE_MAP: Record<string, string> = {
  "01": "부가가치세 일반과세자",
  "02": "부가가치세 간이과세자",
  "03": "부가가치세 과세특례자",
  "04": "부가가치세 면세사업자",
  "05": "수익사업을 영위하지 않는 비영리법인이거나 고유번호가 부여된 단체",
  "06": "고유번호가 부여된 단체",
  "07": "부가가치세 간이과세자(세금계산서 발급사업자)",
  "99": "해당없음",
};

// ============================================================
// 특일 타입 및 매핑
// ============================================================

export type HolidayType =
  | "holidays"
  | "anniversary"
  | "divisionsInfo"
  | "sundryDay"
  | "nationalDay";

export const HOLIDAY_ENDPOINTS: Record<HolidayType, string> = {
  holidays: "getRestDeInfo",
  anniversary: "getAnniversaryInfo",
  divisionsInfo: "get24DivisionsInfo",
  sundryDay: "getSundryDayInfo",
  nationalDay: "getHoliDeInfo",
};

export const HOLIDAY_TYPE_NAMES: Record<HolidayType, string> = {
  holidays: "공휴일",
  anniversary: "기념일",
  divisionsInfo: "24절기",
  sundryDay: "잡절",
  nationalDay: "국경일",
};

// ============================================================
// 국세청 API 응답 타입
// ============================================================

export interface NtsStatusItem {
  b_no: string;
  b_stt_cd: string;
  b_stt: string;
  tax_type_cd: string;
  tax_type: string;
  end_dt?: string;
  utcc_yn?: string;
  tax_type_change_dt?: string;
  invoice_apply_dt?: string;
}

export interface NtsStatusResponse {
  request_cnt: number;
  match_cnt: number;
  data: NtsStatusItem[];
}

export interface NtsValidateRequestParam {
  b_nm?: string;
  p_nm?: string;
  start_dt?: string;
}

export interface NtsValidateItem {
  b_no: string;
  valid: string;
  valid_msg?: string;
  request_param?: NtsValidateRequestParam;
}

export interface NtsValidateResponse {
  request_cnt: number;
  valid_cnt: number;
  data: NtsValidateItem[];
}

export interface BusinessInfo {
  b_no: string;
  start_dt: string;
  p_nm: string;
  p_nm2?: string;
  b_nm?: string;
  corp_no?: string;
  b_sector?: string;
  b_type?: string;
}

// ============================================================
// 천문연구원 API 응답 타입
// ============================================================

export interface KasiHolidayItem {
  dateName: string;
  locdate: number;
  isHoliday?: string;
}

export interface KasiResponseBody {
  totalCount: number;
  items?: {
    item: KasiHolidayItem | KasiHolidayItem[];
  };
}

export interface KasiResponse {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: KasiResponseBody;
  };
}

// ============================================================
// 환경변수 검증
// ============================================================

export function getApiKey(): string {
  const apiKey = process.env.DATA_GO_KR_API_KEY || process.env.NTS_API_KEY;
  if (!apiKey) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "DATA_GO_KR_API_KEY 환경변수가 설정되지 않았습니다. 공공데이터포털에서 API 키를 발급받아 설정해주세요."
    );
  }
  return apiKey;
}
