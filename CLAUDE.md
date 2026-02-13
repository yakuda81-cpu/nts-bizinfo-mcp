# nts-bizinfo-mcp (korea-opendata-mcp)

> 국세청 사업자등록정보 조회 + 한국천문연구원 특일 정보 조회 MCP 서버

## Quick Start

```bash
npm install
npm run build
```

## Architecture

```
src/types.ts          (leaf node - no imports from src/)
    ^    ^    ^    ^
    |    |    |    └── src/validation.ts
    |    |    └─────── src/nts-api.ts
    |    └──────────── src/kasi-api.ts
    └───────────────── src/index.ts -> all modules
```

- `src/types.ts`는 유일한 공유 의존성 (다른 src/ 모듈 import 금지)
- 순환 참조 금지
- 의존성 방향: `index -> validation/nts-api/kasi-api -> types`

## Module Rules

| Module | Responsibility | Lines |
|--------|---------------|:-----:|
| `src/types.ts` | 상수, 타입, 인터페이스, env 검증 | ~155 |
| `src/validation.ts` | MCP 도구 입력 검증 | ~138 |
| `src/nts-api.ts` | 국세청 API 호출 + 포맷팅 | ~130 |
| `src/kasi-api.ts` | 천문연구원 API 호출 + 포맷팅 | ~198 |
| `src/index.ts` | MCP 서버 설정, 도구 핸들러 | ~178 |

- 단일 파일 200줄 초과 시 분리 검토
- 파일당 한 가지 책임

## Coding Conventions

### TypeScript

- ESM only (`"type": "module"`, `.js` 확장자 import)
- strict mode (`noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`)
- 파일명: kebab-case (`nts-api.ts`, `kasi-api.ts`)

### Naming

- 상수: `UPPER_SNAKE_CASE` (`NTS_API_BASE_URL`, `FETCH_TIMEOUT_MS`)
- 타입/인터페이스: `PascalCase` (`NtsStatusItem`, `KasiResponse`)
- 함수: `camelCase` (`callNtsApi`, `validateBusinessNumbers`)
- MCP 응답: 한국어
- 로그: 한국어 (`[NTS] API 오류`, `[KASI] 조회 오류`)

### Quotes

- 큰따옴표(`"`) 사용 (TypeScript ESM)

## Security Rules

- fetch 요청: `redirect: "error"` 필수 (SSRF 방어)
- fetch 요청: `AbortController` 30초 타임아웃
- 에러 응답: 내부 정보 노출 금지 (일반 한국어 메시지)
- 에러 상세: `console.error`로 stderr 로깅
- 사업자등록번호: `/^\d{10}$/` 형식 검증
- 입력 범위: year, month, monthCount 범위 검증

## Environment Variables

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `DATA_GO_KR_API_KEY` | 공공데이터포털 API 인증키 (권장) | 없음 (필수) |
| `NTS_API_KEY` | 하위 호환용 API 키 | 없음 |

## Reference Docs

- `docs/01-plan/features/code-review.plan.md` - 코드 검토 계획
- `docs/02-design/features/code-review.design.md` - 상세 설계
