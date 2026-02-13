import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import {
  MAX_BUSINESS_NUMBERS,
  MIN_YEAR,
  MAX_YEAR,
  MAX_MONTH_COUNT,
  HOLIDAY_ENDPOINTS,
  type HolidayType,
  type BusinessInfo,
} from "./types.js";

const BUSINESS_NUMBER_REGEX = /^\d{10}$/;

/**
 * 사업자등록번호 배열 검증 + 하이픈 제거
 */
export function validateBusinessNumbers(numbers: unknown): string[] {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "사업자등록번호를 입력해주세요."
    );
  }
  if (numbers.length > MAX_BUSINESS_NUMBERS) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `한 번에 최대 ${MAX_BUSINESS_NUMBERS}개까지만 조회할 수 있습니다.`
    );
  }

  return numbers.map((num: unknown, i: number) => {
    if (typeof num !== "string") {
      throw new McpError(
        ErrorCode.InvalidParams,
        `사업자등록번호[${i}]: 문자열이어야 합니다.`
      );
    }
    const clean = num.replace(/-/g, "");
    if (!BUSINESS_NUMBER_REGEX.test(clean)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `사업자등록번호[${i}]: 10자리 숫자 형식이어야 합니다. (입력값: ${num})`
      );
    }
    return clean;
  });
}

/**
 * 진위확인 사업자 배열 검증 + 하이픈 제거
 */
export function validateBusinessInfos(businesses: unknown): BusinessInfo[] {
  if (!Array.isArray(businesses) || businesses.length === 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "진위확인할 사업자 정보를 입력해주세요."
    );
  }
  if (businesses.length > MAX_BUSINESS_NUMBERS) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `한 번에 최대 ${MAX_BUSINESS_NUMBERS}개까지만 확인할 수 있습니다.`
    );
  }

  return businesses.map((biz: Record<string, unknown>, i: number) => {
    const bNo = String(biz.b_no ?? "").replace(/-/g, "");
    if (!BUSINESS_NUMBER_REGEX.test(bNo)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `사업자[${i}] b_no: 10자리 숫자 형식이어야 합니다.`
      );
    }
    const corpNo =
      typeof biz.corp_no === "string"
        ? biz.corp_no.replace(/-/g, "")
        : undefined;
    return {
      ...biz,
      b_no: bNo,
      corp_no: corpNo,
    } as BusinessInfo;
  });
}

/**
 * 특일 조회 파라미터 검증
 */
export interface ValidatedHolidayParams {
  type: HolidayType;
  year: number;
  month?: number;
  monthCount: number;
}

export function validateHolidayParams(
  args: Record<string, unknown>
): ValidatedHolidayParams {
  const type = args.type as string | undefined;
  if (!type || !(type in HOLIDAY_ENDPOINTS)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "유효한 특일 종류를 입력해주세요: holidays, nationalDay, anniversary, divisionsInfo, sundryDay"
    );
  }

  const year = Number(args.year);
  if (!Number.isFinite(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `유효한 연도를 입력해주세요 (${MIN_YEAR}-${MAX_YEAR}).`
    );
  }

  const month =
    args.month != null ? Number(args.month) : undefined;
  if (month != null && (!Number.isInteger(month) || month < 1 || month > 12)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "월은 1-12 범위여야 합니다."
    );
  }

  const monthCount =
    args.monthCount != null ? Number(args.monthCount) : 1;
  if (
    !Number.isInteger(monthCount) ||
    monthCount < 1 ||
    monthCount > MAX_MONTH_COUNT
  ) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `조회 월 수는 1-${MAX_MONTH_COUNT} 범위여야 합니다.`
    );
  }

  return { type: type as HolidayType, year, month, monthCount };
}
