# Korea OpenData MCP Server

한국 공공데이터포털 API를 Claude Desktop, Cursor, Windsurf 등 MCP 지원 클라이언트에서 사용할 수 있는 MCP(Model Context Protocol) 서버입니다.

## 제공 기능

### 국세청 사업자등록정보 API
- **사업자등록 상태조회** (`check_business_status`): 사업자등록번호로 영업상태(계속/휴업/폐업), 과세유형 조회 (최대 100건)
- **사업자등록 진위확인** (`validate_business_registration`): 사업자등록번호, 개업일자, 대표자명 등으로 진위여부 확인 (최대 100건)

### 한국천문연구원 특일 정보 API (`get_korean_holidays`)
- **공휴일 조회**: 대체공휴일 포함 법정 공휴일 정보
- **국경일 조회**: 3.1절, 광복절, 개천절, 한글날 등
- **기념일 조회**: 각종 기념일 정보
- **24절기 조회**: 입춘, 경칩, 춘분 등 24절기 정보
- **잡절 조회**: 한식, 단오, 칠석 등 전통 절기

## 사전 준비: API 키 발급

### 1. 공공데이터포털 회원가입
1. [공공데이터포털](https://www.data.go.kr) 접속
2. 회원가입 (본인인증 필요)

### 2. API 활용신청

#### 국세청 사업자등록정보 API
1. [국세청_사업자등록정보 진위확인 및 상태조회 서비스](https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15081808) 페이지 접속
2. "활용신청" 버튼 클릭
3. 활용목적 작성 후 신청 (자동 승인)

#### 한국천문연구원 특일 정보 API
1. [한국천문연구원_특일 정보](https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15012690) 페이지 접속
2. "활용신청" 버튼 클릭
3. 활용목적 작성 후 신청 (자동 승인)

> **참고**: 두 API 모두 동일한 공공데이터포털 계정의 인증키를 사용합니다.

### 3. 인증키 확인
1. 마이페이지 → 데이터활용 → 오픈API → 개발계정
2. **일반 인증키 (Decoding)** 복사

## 설치

### 방법 1: npm 글로벌 설치 (권장)
```bash
npm install -g korea-opendata-mcp
```

### 방법 2: 소스에서 빌드
```bash
git clone https://github.com/yakuda81-cpu/nts-bizinfo-mcp.git
cd nts-bizinfo-mcp
npm install
npm run build
```

## MCP 클라이언트 연결

### Claude Desktop

`claude_desktop_config.json` 파일을 수정합니다:

- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

#### npm 글로벌 설치 시

```json
{
  "mcpServers": {
    "korea-opendata": {
      "command": "korea-opendata-mcp",
      "env": {
        "DATA_GO_KR_API_KEY": "여기에_본인의_API_인증키_입력"
      }
    }
  }
}
```

#### 소스에서 빌드 시

```json
{
  "mcpServers": {
    "korea-opendata": {
      "command": "node",
      "args": ["C:/Users/사용자명/nts-bizinfo-mcp/dist/index.js"],
      "env": {
        "DATA_GO_KR_API_KEY": "여기에_본인의_API_인증키_입력"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add korea-opendata -- node /path/to/nts-bizinfo-mcp/dist/index.js
```

환경변수는 `.env` 파일 또는 셸 환경에서 설정:
```bash
export DATA_GO_KR_API_KEY="여기에_본인의_API_인증키_입력"
```

> **주의**: `DATA_GO_KR_API_KEY`에 공공데이터포털에서 발급받은 **일반 인증키 (Decoding)** 를 입력하세요.

## 사용 예시

Claude Desktop에서 다음과 같이 사용할 수 있습니다:

### 사업자 상태조회
```
"1234567890 사업자의 상태를 조회해줘"
"삼성전자 사업자번호 1248100998의 영업상태 확인해줘"
```

### 사업자 진위확인
```
"사업자번호 1234567890, 개업일 20200101, 대표자 홍길동으로 진위확인해줘"
```

### 공휴일/특일 조회
```
"2025년 공휴일 알려줘"
"이번 달 공휴일이 있어?"
"올해 24절기 알려줘"
"2025년 국경일 조회해줘"
```

## 제공 도구 (Tools)

### 1. check_business_status
사업자등록번호로 상태 조회

**입력:**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|-----|------|
| business_numbers | string[] | O | 사업자등록번호 목록 (최대 100개) |

**응답 정보:**
- 사업자상태 (계속사업자/휴업자/폐업자)
- 과세유형 (일반과세자/간이과세자/면세사업자 등)
- 폐업일자 (폐업 시)
- 과세유형전환일자

### 2. validate_business_registration
사업자등록정보 진위확인

**입력:**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|-----|------|
| businesses | object[] | O | 확인할 사업자 정보 목록 |
| ↳ b_no | string | O | 사업자등록번호 |
| ↳ start_dt | string | O | 개업일자 (YYYYMMDD) |
| ↳ p_nm | string | O | 대표자명 |
| ↳ p_nm2 | string | - | 대표자명2 (공동대표) |
| ↳ b_nm | string | - | 상호 |
| ↳ corp_no | string | - | 법인등록번호 |
| ↳ b_sector | string | - | 주업태 |
| ↳ b_type | string | - | 주종목 |

### 3. get_korean_holidays
한국의 공휴일, 국경일, 기념일, 24절기, 잡절 정보 조회

**입력:**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|-----|------|
| type | string | O | 조회할 특일 종류 |
| year | number | O | 조회할 연도 (예: 2025) |
| month | number | - | 조회할 시작 월 (1-12). 생략 시 연도 전체 조회 |
| monthCount | number | - | 조회할 월 수 (기본값: 1) |

**type 옵션:**
| 값 | 설명 |
|---|------|
| holidays | 공휴일 (대체공휴일 포함) |
| nationalDay | 국경일 (3.1절, 광복절, 개천절, 한글날) |
| anniversary | 기념일 |
| divisionsInfo | 24절기 |
| sundryDay | 잡절 (한식, 단오, 칠석 등) |

**응답 정보:**
- 특일명
- 날짜
- 공휴일 여부

## API 제한사항

### 국세청 사업자등록정보 API
- 1회 호출 시 최대 100건
- 1일 최대 100만 건

### 한국천문연구원 특일 정보 API
- 1일 최대 10,000건

## 프로젝트 구조

```
src/
├── types.ts        # 상수, 타입, 인터페이스, 환경변수 검증
├── validation.ts   # MCP 도구 입력 검증
├── nts-api.ts      # 국세청 API 호출 + 결과 포맷팅
├── kasi-api.ts     # 천문연구원 API 호출 + 결과 포맷팅
└── index.ts        # MCP 서버 설정, 도구 핸들러
```

의존성 방향: `index` -> `validation` / `nts-api` / `kasi-api` -> `types` (단방향, 순환 참조 없음)

## 보안

- **SSRF 방어**: 모든 fetch 요청에 `redirect: "error"` 적용
- **타임아웃**: `AbortController` 기반 30초 타임아웃
- **에러 은닉**: 내부 에러 상세는 stderr 로깅, 사용자에게는 일반 메시지 반환
- **입력 검증**: 사업자등록번호 `/^\d{10}$/` 정규식, year/month/monthCount 범위 검증

## 트러블슈팅

### "DATA_GO_KR_API_KEY 환경변수가 설정되지 않았습니다"
- MCP 클라이언트 설정의 `env` 섹션에 API 키가 올바르게 입력되었는지 확인
- `NTS_API_KEY`도 하위 호환으로 지원됨

### "국세청 API 요청에 실패했습니다" / "천문연구원 API 요청에 실패했습니다"
- API 키가 올바른지 확인 (Decoding 키 사용)
- 공공데이터포털에서 해당 서비스 활용신청이 완료되었는지 확인
- 일일 호출 한도 초과 시 다음 날 다시 시도

### "API가 XML 응답을 반환했습니다"
- 일시적인 API 서버 오류. 잠시 후 다시 시도

## Roadmap

- [ ] npm 레지스트리 배포 (`npm publish`)
- [ ] GitHub Actions CI/CD 구성
- [ ] 단위 테스트 추가

## 라이선스

MIT License

## 참고 자료

- [공공데이터포털 - 국세청_사업자등록정보 진위확인 및 상태조회 서비스](https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15081808)
- [공공데이터포털 - 한국천문연구원_특일 정보](https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15012690)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
