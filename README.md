# NTS BizInfo MCP Server

국세청 사업자등록정보 진위확인 및 상태조회 서비스를 Claude Desktop, ChatGPT 등에서 사용할 수 있는 MCP(Model Context Protocol) 서버입니다.

## 기능

- **사업자등록 상태조회**: 사업자등록번호로 영업상태(계속/휴업/폐업), 과세유형 조회
- **사업자등록 진위확인**: 사업자등록번호, 개업일자, 대표자명 등으로 진위여부 확인

## 사전 준비: API 키 발급

### 1. 공공데이터포털 회원가입
1. [공공데이터포털](https://www.data.go.kr) 접속
2. 회원가입 (본인인증 필요)

### 2. API 활용신청
1. [국세청_사업자등록정보 진위확인 및 상태조회 서비스](https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15081808) 페이지 접속
2. "활용신청" 버튼 클릭
3. 활용목적 작성 후 신청 (자동 승인)

### 3. 인증키 확인
1. 마이페이지 → 데이터활용 → 오픈API → 개발계정
2. **일반 인증키 (Decoding)** 복사

## 설치

### 방법 1: npm 글로벌 설치 (권장)
```bash
npm install -g nts-bizinfo-mcp
```

### 방법 2: 소스에서 빌드
```bash
git clone https://github.com/your-repo/nts-bizinfo-mcp.git
cd nts-bizinfo-mcp
npm install
npm run build
```

## Claude Desktop 연결

`claude_desktop_config.json` 파일을 수정합니다:

### Windows
경로: `%APPDATA%\Claude\claude_desktop_config.json`

### macOS
경로: `~/Library/Application Support/Claude/claude_desktop_config.json`

### 설정 내용

```json
{
  "mcpServers": {
    "nts-bizinfo": {
      "command": "node",
      "args": ["C:/Users/사용자명/nts-bizinfo-mcp/dist/index.js"],
      "env": {
        "NTS_API_KEY": "여기에_본인의_API_인증키_입력"
      }
    }
  }
}
```

> **주의**: `NTS_API_KEY`에 공공데이터포털에서 발급받은 **일반 인증키 (Decoding)** 를 입력하세요.

## 사용 예시

Claude Desktop에서 다음과 같이 사용할 수 있습니다:

### 상태조회
```
"1234567890 사업자의 상태를 조회해줘"
"삼성전자 사업자번호 1248100998의 영업상태 확인해줘"
```

### 진위확인
```
"사업자번호 1234567890, 개업일 20200101, 대표자 홍길동으로 진위확인해줘"
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

## API 제한사항

- 1회 호출 시 최대 100건
- 1일 최대 100만 건
- 개발 단계: 트래픽 100만 건 제공
- 운영 단계: 사용사례 등록 시 추가 트래픽 신청 가능

## 트러블슈팅

### "NTS_API_KEY 환경변수가 설정되지 않았습니다" 오류
- Claude Desktop 설정의 `env` 섹션에 API 키가 올바르게 입력되었는지 확인
- API 키에 특수문자가 있다면 따옴표로 감싸기

### "API 요청 실패: 401" 오류
- API 키가 올바른지 확인 (Decoding 키 사용)
- 공공데이터포털에서 해당 서비스 활용신청이 완료되었는지 확인

### "API 요청 실패: 429" 오류
- 일일 호출 한도 초과. 다음 날 다시 시도

## 라이선스

MIT License

## 참고 자료

- [공공데이터포털 - 국세청_사업자등록정보 진위확인 및 상태조회 서비스](https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15081808)
- [Model Context Protocol (MCP) 문서](https://modelcontextprotocol.io/)
