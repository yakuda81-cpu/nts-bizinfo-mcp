# Design: 글로벌 CLAUDE.md 기반 코드 검토 및 개선

> Plan 문서의 개선 항목을 구체적인 모듈 설계, 인터페이스, 함수 시그니처로 상세화한다.

## 참조

- Plan: `docs/01-plan/features/code-review.plan.md`

## 1. 모듈 구조

### 1.1 파일 구성

| 모듈 | 책임 | 예상 줄 수 |
|------|------|:----------:|
| `src/types.ts` | 상수, 타입, 인터페이스, 환경변수 검증 | ~80 |
| `src/validation.ts` | 입력 검증 (사업자번호, year/month) | ~60 |
| `src/nts-api.ts` | 국세청 API 호출 + 응답 포맷팅 | ~120 |
| `src/kasi-api.ts` | 천문연구원 API 호출 + 응답 포맷팅 | ~160 |
| `src/index.ts` | MCP 서버 설정, 도구 정의, 핸들러 | ~90 |

### 1.2 의존성 방향

```
types.ts (leaf node - 다른 src/ 모듈 import 금지)
  ^   ^   ^   ^
  |   |   |   └── validation.ts (types만 import)
  |   |   └────── nts-api.ts (types만 import)
  |   └────────── kasi-api.ts (types만 import)
  └────────────── index.ts → validation, nts-api, kasi-api, types
```

- 순환 참조 금지
- `types.ts`는 리프 노드: MCP SDK 타입만 re-export, 다른 내부 모듈 import 없음
- 모든 모듈은 `types.ts`에서만 공유 타입/상수를 가져옴

## 2. src/types.ts 설계

### 2.1 상수

```typescript
// API 기본 URL
export const NTS_API_BASE_URL = "https://api.odcloud.kr/api/nts-businessman/v1";
export const KASI_API_BASE_URL = "http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService";

// 제한값
export const MAX_BUSINESS_NUMBERS = 100;
export const MIN_YEAR = 1900;
export const MAX_YEAR = 2100;
export const FETCH_TIMEOUT_MS = 30_000;
export const MAX_MONTH_COUNT = 12;

// 코드 매핑
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

export const HOLIDAY_ENDPOINTS: Record<HolidayType, string> = { ... };
export const HOLIDAY_TYPE_NAMES: Record<HolidayType, string> = { ... };
```

### 2.2 타입/인터페이스

```typescript
// --- 국세청 API 응답 ---

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

// --- 천문연구원 API 응답 ---

export type HolidayType = "holidays" | "anniversary" | "divisionsInfo" | "sundryDay" | "nationalDay";

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
```

### 2.3 환경변수 검증

```typescript
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

export function getApiKey(): string {
  const apiKey = process.env.DATA_GO_KR_API_KEY || process.env.NTS_API_KEY;
  if (!apiKey) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "DATA_GO_KR_API_KEY 환경변수가 설정되지 않았습니다."
    );
  }
  return apiKey;
}
```

## 3. src/validation.ts 설계

### 3.1 사업자등록번호 검증

```typescript
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { MAX_BUSINESS_NUMBERS } from "./types.js";

const BUSINESS_NUMBER_REGEX = /^\d{10}$/;

/**
 * 사업자등록번호 배열 검증 + 하이픈 제거
 * @returns 정제된 10자리 숫자 배열
 */
export function validateBusinessNumbers(numbers: unknown): string[] {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    throw new McpError(ErrorCode.InvalidParams, "사업자등록번호를 입력해주세요.");
  }
  if (numbers.length > MAX_BUSINESS_NUMBERS) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `한 번에 최대 ${MAX_BUSINESS_NUMBERS}개까지만 조회할 수 있습니다.`
    );
  }

  return numbers.map((num, i) => {
    if (typeof num !== "string") {
      throw new McpError(ErrorCode.InvalidParams, `사업자등록번호[${i}]: 문자열이어야 합니다.`);
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
```

### 3.2 진위확인 사업자 정보 검증

```typescript
import { BusinessInfo, MAX_BUSINESS_NUMBERS } from "./types.js";

/**
 * 진위확인 사업자 배열 검증 + 하이픈 제거
 * @returns 정제된 사업자 정보 배열
 */
export function validateBusinessInfos(businesses: unknown): BusinessInfo[] {
  if (!Array.isArray(businesses) || businesses.length === 0) {
    throw new McpError(ErrorCode.InvalidParams, "진위확인할 사업자 정보를 입력해주세요.");
  }
  if (businesses.length > MAX_BUSINESS_NUMBERS) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `한 번에 최대 ${MAX_BUSINESS_NUMBERS}개까지만 확인할 수 있습니다.`
    );
  }

  return businesses.map((biz, i) => {
    const bNo = String(biz.b_no ?? "").replace(/-/g, "");
    if (!BUSINESS_NUMBER_REGEX.test(bNo)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `사업자[${i}] b_no: 10자리 숫자 형식이어야 합니다.`
      );
    }
    return {
      ...biz,
      b_no: bNo,
      corp_no: biz.corp_no ? biz.corp_no.replace(/-/g, "") : undefined,
    };
  });
}
```

### 3.3 특일 조회 파라미터 검증

```typescript
import { HolidayType, HOLIDAY_ENDPOINTS, MIN_YEAR, MAX_YEAR, MAX_MONTH_COUNT } from "./types.js";

export interface ValidatedHolidayParams {
  type: HolidayType;
  year: number;
  month?: number;
  monthCount: number;
}

/**
 * 특일 조회 파라미터 검증
 */
export function validateHolidayParams(args: Record<string, unknown>): ValidatedHolidayParams {
  const type = args.type as string;
  if (!type || !HOLIDAY_ENDPOINTS[type as HolidayType]) {
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

  const month = args.month != null ? Number(args.month) : undefined;
  if (month != null && (!Number.isInteger(month) || month < 1 || month > 12)) {
    throw new McpError(ErrorCode.InvalidParams, "월은 1-12 범위여야 합니다.");
  }

  const monthCount = args.monthCount != null ? Number(args.monthCount) : 1;
  if (!Number.isInteger(monthCount) || monthCount < 1 || monthCount > MAX_MONTH_COUNT) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `조회 월 수는 1-${MAX_MONTH_COUNT} 범위여야 합니다.`
    );
  }

  return { type: type as HolidayType, year, month, monthCount };
}
```

## 4. src/nts-api.ts 설계

### 4.1 공통 fetch 유틸리티

각 API 모듈에서 사용하는 안전한 fetch 래퍼:

```typescript
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { FETCH_TIMEOUT_MS } from "./types.js";

/**
 * 타임아웃 + redirect 차단이 적용된 안전한 fetch
 */
async function safeFetch(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: "error",
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

> **설계 결정**: `safeFetch`를 별도 `src/http.ts`로 분리하지 않고 `nts-api.ts`와 `kasi-api.ts` 각각에 동일 패턴으로 포함한다. 이유: (1) 함수가 5줄 수준으로 매우 짧음, (2) 별도 모듈 추가 대비 복잡도 감소, (3) 두 모듈 간 의존성 발생 방지. 중복이 3곳 이상으로 늘어나면 그때 추출한다.

### 4.2 국세청 API 호출

```typescript
import {
  NTS_API_BASE_URL,
  BUSINESS_STATUS_MAP,
  TAX_TYPE_MAP,
  NtsStatusResponse,
  NtsStatusItem,
  NtsValidateResponse,
  NtsValidateItem,
  getApiKey,
} from "./types.js";

/**
 * 국세청 API POST 요청
 * - redirect: "error" (SSRF 방지)
 * - AbortController 30초 타임아웃
 * - 에러 원문 비노출 (console.error로 로깅)
 */
export async function callNtsApi(endpoint: string, body: object): Promise<NtsStatusResponse | NtsValidateResponse> {
  const apiKey = getApiKey();
  const url = `${NTS_API_BASE_URL}/${endpoint}?serviceKey=${encodeURIComponent(apiKey)}`;

  const response = await safeFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[NTS] API 오류 ${response.status}: ${errorText}`);
    throw new McpError(ErrorCode.InternalError, "국세청 API 요청에 실패했습니다.");
  }

  return response.json() as Promise<NtsStatusResponse | NtsValidateResponse>;
}
```

### 4.3 결과 포맷팅

```typescript
export function formatStatusResult(data: NtsStatusItem[]): string { ... }
export function formatValidateResult(data: NtsValidateItem[]): string { ... }
```

- `any` → `NtsStatusItem[]` / `NtsValidateItem[]` 타입으로 교체
- 로직 변경 없음 (포맷팅 문자열 동일 유지)

## 5. src/kasi-api.ts 설계

### 5.1 천문연구원 API 호출

```typescript
import {
  KASI_API_BASE_URL,
  FETCH_TIMEOUT_MS,
  HOLIDAY_ENDPOINTS,
  HOLIDAY_TYPE_NAMES,
  HolidayType,
  KasiResponse,
  KasiHolidayItem,
  getApiKey,
} from "./types.js";

/**
 * 천문연구원 API GET 요청
 * - redirect: "error" (SSRF 방지)
 * - AbortController 30초 타임아웃
 * - XML 응답 감지 시 에러
 * - 에러 원문 비노출
 */
export async function callKasiApi(
  endpoint: string,
  year: number,
  month?: number
): Promise<KasiResponse> { ... }
```

### 5.2 결과 포맷팅

```typescript
export function formatDate(dateStr: string): string { ... }
export function formatHolidayResult(data: KasiResponse, typeName: string): string { ... }
export async function getHolidaysForMonths(
  type: HolidayType,
  year: number,
  startMonth: number,
  monthCount: number
): Promise<string> { ... }
```

- `any` → `KasiResponse`, `KasiHolidayItem` 타입으로 교체
- `getHolidaysForMonths` 내부 에러 로깅: 에러 원문은 `console.error`로, 사용자에게는 "일부 월 조회에 실패했습니다" 메시지

## 6. src/index.ts 설계

### 6.1 역할

MCP 서버 설정 + 도구 정의 + 핸들러 라우팅만 담당 (~90줄).

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

import { validateBusinessNumbers, validateBusinessInfos, validateHolidayParams } from "./validation.js";
import { callNtsApi, formatStatusResult, formatValidateResult } from "./nts-api.js";
import { getHolidaysForMonths } from "./kasi-api.js";
```

### 6.2 핸들러 구조

```typescript
// CallToolRequest 핸들러
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "check_business_status": {
        const cleanNumbers = validateBusinessNumbers(args?.business_numbers);
        const result = await callNtsApi("status", { b_no: cleanNumbers });
        // ... 포맷팅 + 응답
      }
      case "validate_business_registration": {
        const cleanBusinesses = validateBusinessInfos(args?.businesses);
        const result = await callNtsApi("validate", { businesses: cleanBusinesses });
        // ... 포맷팅 + 응답
      }
      case "get_korean_holidays": {
        const params = validateHolidayParams(args as Record<string, unknown>);
        // ... 호출 + 응답
      }
      default:
        throw new McpError(ErrorCode.MethodNotFound, `알 수 없는 도구입니다: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) throw error;
    console.error("[MCP] 도구 실행 오류:", error);
    throw new McpError(ErrorCode.InternalError, "도구 실행 중 오류가 발생했습니다.");
  }
});
```

핵심 변경: catch-all에서 `error.message` 직접 노출 제거 → 일반 메시지 반환, 상세는 `console.error`

## 7. 보안 개선 상세

### 7.1 S1+S2: redirect 차단

| 위치 | 변경 전 | 변경 후 |
|------|--------|--------|
| `callNtsApi` fetch | 옵션 없음 | `redirect: "error"` |
| `callKasiApi` fetch | 옵션 없음 | `redirect: "error"` |

### 7.2 S7+P1: HTTP 타임아웃

```typescript
// safeFetch 패턴 (nts-api.ts, kasi-api.ts 각각에 적용)
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
try {
  return await fetch(url, { ...options, signal: controller.signal, redirect: "error" });
} finally {
  clearTimeout(timeoutId);
}
```

### 7.3 S3+S4: 에러 메시지 정리

| 위치 | 변경 전 | 변경 후 |
|------|--------|--------|
| `callNtsApi` 에러 | `${response.status} ${response.statusText} - ${errorText}` | `console.error(...)` + "국세청 API 요청에 실패했습니다." |
| `callKasiApi` 에러 | `${response.status} ${response.statusText} - ${errorText}` | `console.error(...)` + "천문연구원 API 요청에 실패했습니다." |
| catch-all | `${error.message}` | `console.error(...)` + "도구 실행 중 오류가 발생했습니다." |

### 7.4 S5: 사업자등록번호 형식 검증

- 하이픈 제거 후 `/^\d{10}$/` 정규식 검증
- `check_business_status`와 `validate_business_registration` 모두 동일 검증

### 7.5 S6: year/month 범위 검증 일관화

- `year`: `MIN_YEAR` ~ `MAX_YEAR` (NTS API에도 적용 — 현재는 holidays만)
- `month`: 1-12 범위
- `monthCount`: 1-`MAX_MONTH_COUNT` 범위

## 8. TypeScript 엄격 설정

### 8.1 tsconfig.json 변경

```json
{
  "compilerOptions": {
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### 8.2 영향 분석

| 옵션 | 영향 받는 코드 | 대응 |
|------|--------------|------|
| `noUncheckedIndexedAccess` | `BUSINESS_STATUS_MAP[item.b_stt_cd]`, `TAX_TYPE_MAP[item.tax_type_cd]` 등 | `?? "알 수 없음"` fallback 이미 존재 — 타입만 `string \| undefined`로 변경 |
| `noUnusedLocals` | 분리 과정에서 발생 가능 | 빌드 시 확인/제거 |
| `noUnusedParameters` | 콜백의 미사용 파라미터 | `_` 접두사 적용 |

## 9. CLAUDE.md 설계

프로젝트 루트에 `CLAUDE.md` 생성:

```markdown
# nts-bizinfo-mcp (korea-opendata-mcp)

> 국세청 사업자등록정보 + 한국천문연구원 특일 정보 조회 MCP 서버

## Quick Start
npm install && npm run build

## Architecture
types.ts (leaf) ← validation.ts, nts-api.ts, kasi-api.ts
index.ts → all modules

## Module Rules
- 단일 파일 200줄 이하
- types.ts는 리프 노드
- 순환 참조 금지

## Coding Conventions
- ESM + 큰따옴표
- 상수: UPPER_SNAKE_CASE
- 파일명: kebab-case
- any 타입 사용 금지

## Security Rules
- fetch: redirect: "error" + AbortController 30초
- 에러 응답: 내부 정보 노출 금지
- 사업자번호: /^\d{10}$/ 검증
```

## 10. .gitignore 확인

현재 `.gitignore`에 `.env` 포함 확인됨 (E1 해결):
```
node_modules/
dist/
.env
*.log
.DS_Store
```

## 11. 구현 순서

| 순서 | 작업 | 의존성 |
|:----:|------|--------|
| 1 | `src/types.ts` 생성 (상수, 타입, getApiKey) | 없음 |
| 2 | `src/validation.ts` 생성 (입력 검증 함수 3개) | types.ts |
| 3 | `src/nts-api.ts` 생성 (safeFetch, callNtsApi, format 2개) | types.ts |
| 4 | `src/kasi-api.ts` 생성 (safeFetch, callKasiApi, format, getHolidaysForMonths) | types.ts |
| 5 | `src/index.ts` 리팩토링 (543줄 → ~90줄) | validation, nts-api, kasi-api |
| 6 | `tsconfig.json` strict 옵션 추가 | 모든 모듈 완성 후 |
| 7 | `npm run build` 검증 | 전체 |
| 8 | `CLAUDE.md` 생성 | 전체 완성 후 |

## 12. 성공 기준

| # | 기준 | 검증 방법 |
|---|------|----------|
| 1 | 보안 항목 7개 해결 | `redirect: "error"` grep, AbortController grep, 에러 메시지 검토 |
| 2 | 모든 모듈 200줄 이하 | `wc -l src/*.ts` |
| 3 | `any` 타입 0개 | `grep "any" src/*.ts` |
| 4 | 매직 넘버 0개 | 상수 참조 확인 |
| 5 | tsconfig strict 3개 | tsconfig.json 확인 |
| 6 | `npm run build` 성공 | exit code 0 |

## 13. 범위 외

- 테스트 작성 (별도 PDCA)
- CI/CD 구성
- README 업데이트
- `getHolidaysForMonths` N+1 직렬 호출 최적화 (API 제약으로 현재 수준 유지)
