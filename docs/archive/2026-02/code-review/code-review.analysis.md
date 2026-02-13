# code-review Gap Analysis Report

> Design vs Implementation 비교 분석

| 항목 | 내용 |
|------|------|
| 프로젝트 | nts-bizinfo-mcp (korea-opendata-mcp) |
| 분석일 | 2026-02-14 |
| Design 문서 | `docs/02-design/features/code-review.design.md` |
| Plan 문서 | `docs/01-plan/features/code-review.plan.md` |

## 1. Overall Match Rate: 98.8%

| # | Check Item | Design Section | Score | Status |
|:-:|-----------|:--------------:|:-----:|:------:|
| 1 | Module Structure (5 modules, dependency direction) | Section 1 | 100% | PASS |
| 2 | src/types.ts (constants 6+, types 10+, getApiKey) | Section 2 | 100% | PASS |
| 3 | src/validation.ts (3 validators, regex, range checks) | Section 3 | 100% | PASS |
| 4 | src/nts-api.ts (safeFetch, callNtsApi, formatters, typed) | Section 4 | 100% | PASS |
| 5 | src/kasi-api.ts (safeFetch, callKasiApi, formatters, typed) | Section 5 | 100% | PASS |
| 6 | src/index.ts (MCP server, imports, validation-first, catch-all) | Section 6 | 100% | PASS |
| 7 | Security S1+S2: redirect: "error" in both fetches | Section 7.1 | 100% | PASS |
| 8 | Security S7+P1: AbortController timeout in both fetches | Section 7.2 | 100% | PASS |
| 9 | Security S3+S4: Error messages sanitized | Section 7.3 | 100% | PASS |
| 10 | Security S5: Business number regex `/^\d{10}$/` | Section 7.4 | 100% | PASS |
| 11 | Security S6: year/month/monthCount range validation | Section 7.5 | 100% | PASS |
| 12 | TypeScript strict (3 options in tsconfig.json) | Section 8 | 100% | PASS |
| 13 | CLAUDE.md (architecture, rules, conventions, security) | Section 9 | 100% | PASS |
| 14 | No magic numbers | Plan C1 | 83% | MINOR GAP |

```
+---------------------------------------------+
|  Overall Match Rate: 98.8%                   |
+---------------------------------------------+
|  PASS (100%):       13 items                 |
|  MINOR GAP (83%):    1 item                  |
|  MAJOR GAP:          0 items                 |
|  NOT IMPLEMENTED:    0 items                 |
+---------------------------------------------+
```

## 2. Detailed Findings

### 2.1 PASS Items (13/14)

- **Module Structure**: 5 modules, types.ts leaf node, 순환 참조 없음, 단방향 의존성
- **types.ts**: 8개 상수, 4개 매핑, 10개 타입/인터페이스, `getApiKey()` 함수
- **validation.ts**: `validateBusinessNumbers`, `validateBusinessInfos`, `validateHolidayParams` 모두 구현
- **nts-api.ts**: `safeFetch` + `callNtsApi` + 포맷터 2개, `any` 타입 없음
- **kasi-api.ts**: `safeFetch` + `callKasiApi` + 포맷터 + `getHolidaysForMonths`, `any` 타입 없음
- **index.ts**: 4개 모듈 import, 검증 후 API 호출, catch-all 에러 sanitize
- **Security 7개**: redirect:"error", AbortController, 에러 원문 비노출, 사업자번호 regex, 범위 검증
- **TypeScript**: `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`
- **CLAUDE.md**: Architecture, Module Rules, Conventions, Security Rules 전체 포함

### 2.2 Minor Gap (1/14)

**Item 14: No Magic Numbers (83%)**

Plan의 주요 매직 넘버는 모두 상수화됨:

| 매직 넘버 | 상수 | 상태 |
|:-:|:-:|:-:|
| `100` (max items) | `MAX_BUSINESS_NUMBERS` | PASS |
| `100` (numOfRows) | `KASI_NUM_OF_ROWS` | PASS |
| `1900` (min year) | `MIN_YEAR` | PASS |
| `2100` (max year) | `MAX_YEAR` | PASS |
| `30000` (timeout) | `FETCH_TIMEOUT_MS` | PASS |
| `12` (max months) | `MAX_MONTH_COUNT` | PASS |

잔여 리터럴 (도메인 고유값, 낮은 심각도):

| 리터럴 | 위치 | 컨텍스트 |
|:-:|:-:|:-:|
| `1, 12` | index.ts:153 | January, 12 months (전체 연도 조회) |
| `8` | kasi-api.ts:84 | YYYYMMDD 포맷 길이 |
| `12` | kasi-api.ts:152-153 | 월 오버플로 처리 |

Design 문서 자체에서도 동일한 리터럴을 사용하므로 설계 대비 갭이라기보다 도메인 고유값.

## 3. Implementation Additions (Design에 없는 구현)

| 항목 | 위치 | 설명 |
|------|------|------|
| `KASI_NUM_OF_ROWS` | types.ts:17 | numOfRows 쿼리 파라미터 상수 |
| `formatHolidayItem` | kasi-api.ts:88-95 | DRY 포맷팅 헬퍼 |

두 항목 모두 코드 품질 개선이며 Design과 모순 없음.

## 4. Architecture Compliance

| 규칙 | 상태 | 근거 |
|------|:----:|------|
| types.ts leaf node | PASS | MCP SDK만 import |
| 순환 참조 없음 | PASS | 단방향: index -> {validation, nts-api, kasi-api} -> types |
| 200줄 이하 | PASS | 최대 198줄 (kasi-api.ts) |
| 파일당 단일 책임 | PASS | 검증 |
| `any` 타입 0개 | PASS | grep 결과 0건 |

## 5. Convention Compliance

| 카테고리 | 규칙 | 상태 |
|----------|------|:----:|
| 상수 | UPPER_SNAKE_CASE | PASS |
| 타입 | PascalCase | PASS |
| 함수 | camelCase | PASS |
| 파일명 | kebab-case | PASS |
| 따옴표 | 큰따옴표 | PASS |
| 모듈 | ESM `.js` import | PASS |

## 6. Conclusion

Match Rate **98.8%** >= 90% 기준 충족. 설계와 구현이 충실히 일치하며, 보안 7개 항목 전체 해결, 모듈 분리 완료, `any` 타입 제거, TypeScript strict 설정 추가됨.
