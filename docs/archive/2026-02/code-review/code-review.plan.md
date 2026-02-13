# Plan: 글로벌 CLAUDE.md 기반 코드 검토 및 개선

> nts-bizinfo-mcp 프로젝트를 글로벌 CLAUDE.md 규칙에 맞춰 검토하고 개선사항을 도출한다.

## Feature Overview

| 항목 | 내용 |
|------|------|
| Feature | code-review |
| 프로젝트 | nts-bizinfo-mcp (korea-opendata-mcp) |
| 현재 상태 | 단일 파일 `src/index.ts` (543줄), 테스트 없음, CLAUDE.md 없음 |
| 목표 | 글로벌 CLAUDE.md 보안/구조/품질 규칙 준수 |

## 검토 기준: 글로벌 CLAUDE.md 규칙

### 1. 보안 (CRITICAL)

| # | 규칙 | 현재 상태 | 심각도 | 개선 필요 |
|---|------|----------|--------|----------|
| S1 | SSRF 방지: 외부 URL 요청 시 도메인 화이트리스트 | API URL 하드코딩이지만 `redirect` 옵션 없음 | HIGH | YES |
| S2 | SSRF 방지: `redirect: "error"` 옵션 | `callNtsApi`, `callKasiApi` 모두 미설정 | HIGH | YES |
| S3 | 에러 처리: 내부 에러 상세 노출 금지 | `errorText` 원문 노출 (L71, L191) | MEDIUM | YES |
| S4 | 에러 처리: 스택 트레이스 노출 | catch-all에서 `error.message` 직접 노출 (L527) | MEDIUM | YES |
| S5 | 입력 검증: 사업자등록번호 형식 검증 | `.replace(/-/g, "")` 만 수행, 10자리 숫자 검증 없음 | MEDIUM | YES |
| S6 | 입력 검증: year/month 범위 | holidays만 검증, NTS API 미검증 | LOW | YES |
| S7 | HTTP 타임아웃 필수 | fetch에 `AbortController` 타임아웃 없음 | HIGH | YES |

### 2. 모듈 설계

| # | 규칙 | 현재 상태 | 개선 필요 |
|---|------|----------|----------|
| M1 | 단일 파일 200줄 초과 시 분리 검토 | `index.ts` 543줄 (200줄 기준 2.7배 초과) | YES |
| M2 | 함수/메서드는 한 가지 책임만 | `CallToolRequest` 핸들러가 검증+호출+포맷 모두 처리 | YES |
| M3 | 순환 참조 금지 | 단일 파일이므로 해당 없음 | N/A |
| M4 | 의존성 단방향 | 모듈 분리 시 적용 | N/A |

### 3. 코딩 컨벤션

| # | 규칙 | 현재 상태 | 개선 필요 |
|---|------|----------|----------|
| C1 | 매직 넘버 금지 - 상수 정의 | `100` (max items), `1900`/`2100` (year range) 매직 넘버 | YES |
| C2 | `any` 타입 사용 | `callNtsApi`: `Promise<any>`, `formatStatusResult(data: any[])` 등 다수 | YES |
| C3 | 사용하지 않는 코드 삭제 | 해당 없음 | NO |

### 4. 성능

| # | 규칙 | 현재 상태 | 개선 필요 |
|---|------|----------|----------|
| P1 | HTTP 타임아웃 필수 | AbortController 미사용 | YES (S7과 동일) |
| P2 | N+1 요청 주의 | `getHolidaysForMonths` 직렬 12회 호출 | LOW (API 제약) |

### 5. TypeScript 엄격 설정

| # | 규칙 | 현재 상태 | 개선 필요 |
|---|------|----------|----------|
| T1 | `noUncheckedIndexedAccess` | tsconfig에 미설정 | YES |
| T2 | `noUnusedLocals` | tsconfig에 미설정 | YES |
| T3 | `noUnusedParameters` | tsconfig에 미설정 | YES |

### 6. 테스트

| # | 규칙 | 현재 상태 | 개선 필요 |
|---|------|----------|----------|
| TS1 | 테스트 존재 | 없음 | YES (별도 PDCA) |

### 7. 기타

| # | 규칙 | 현재 상태 | 개선 필요 |
|---|------|----------|----------|
| E1 | .gitignore에 .env 포함 | 확인 필요 | CHECK |
| E2 | stdin/TTY 안전성 | MCP 서버이므로 해당 없음 | NO |

## 개선 계획

### Phase 1: 보안 (우선순위 HIGH)

1. **S1+S2: fetch에 redirect 차단 추가**
   - `callNtsApi`, `callKasiApi` 모두 `redirect: "error"` 옵션 추가

2. **S7+P1: HTTP 타임아웃 추가**
   - `AbortController` + `setTimeout(30초)` 패턴 도입
   - 공통 fetch 유틸리티 함수 추출

3. **S3+S4: 에러 메시지 정리**
   - 외부 API 에러 원문(`errorText`, `error.message`) 사용자에게 직접 노출 제거
   - 일반적인 한국어 에러 메시지 반환, 상세는 `console.error`로 로깅

4. **S5: 사업자등록번호 형식 검증**
   - 하이픈 제거 후 `/^\d{10}$/` 정규식 검증

5. **S6: 입력 범위 검증 일관화**
   - `month` 범위 (1-12), `monthCount` 범위 (1-12)
   - `business_numbers` 각 항목 형식 검증

### Phase 2: 모듈 분리 (M1, M2)

`src/index.ts` (543줄) → 5개 모듈로 분리:

| 모듈 | 책임 | 예상 줄 수 |
|------|------|:----------:|
| `src/types.ts` | 상수, 타입, 환경변수 검증 | ~60 |
| `src/validation.ts` | 입력 검증 (사업자번호, year/month) | ~50 |
| `src/nts-api.ts` | 국세청 API 호출 + 포맷팅 | ~120 |
| `src/kasi-api.ts` | 천문연구원 API 호출 + 포맷팅 | ~150 |
| `src/index.ts` | MCP 서버 설정, 도구 핸들러 | ~80 |

의존성 방향:
```
types.ts (leaf node)
  ▲   ▲   ▲   ▲
  │   │   │   └── validation.ts
  │   │   └────── nts-api.ts
  │   └────────── kasi-api.ts
  └────────────── index.ts → all modules
```

### Phase 3: 코딩 컨벤션 (C1, C2)

1. **매직 넘버 상수화**
   - `MAX_BUSINESS_NUMBERS = 100`
   - `MIN_YEAR = 1900`, `MAX_YEAR = 2100`
   - `FETCH_TIMEOUT_MS = 30_000`

2. **any 타입 제거**
   - API 응답 인터페이스 정의 (`NtsStatusResponse`, `NtsValidateResponse`, `KasiResponse`)
   - 포맷팅 함수 파라미터 타입 명시

### Phase 4: TypeScript 엄격 설정 (T1-T3)

tsconfig.json에 추가:
```json
{
  "noUncheckedIndexedAccess": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

## 대상 파일

| 파일 | 액션 |
|------|------|
| `src/types.ts` | 신규 |
| `src/validation.ts` | 신규 |
| `src/nts-api.ts` | 신규 |
| `src/kasi-api.ts` | 신규 |
| `src/index.ts` | 수정 (543줄 → ~80줄) |
| `tsconfig.json` | 수정 |
| `CLAUDE.md` | 신규 |

## 범위 외

- 테스트 작성 (별도 PDCA 사이클)
- CI/CD 구성
- README 업데이트

## 성공 기준

1. 보안 항목 7개 모두 해결
2. 모든 모듈 200줄 이하
3. `any` 타입 0개
4. 매직 넘버 0개
5. tsconfig strict 옵션 3개 추가
6. `npm run build` 성공
