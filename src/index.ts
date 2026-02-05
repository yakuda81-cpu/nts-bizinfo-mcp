#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

// API 설정
const API_BASE_URL = "https://api.odcloud.kr/api/nts-businessman/v1";

// 환경변수에서 API 키 가져오기
const getApiKey = (): string => {
  const apiKey = process.env.NTS_API_KEY;
  if (!apiKey) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "NTS_API_KEY 환경변수가 설정되지 않았습니다. 공공데이터포털에서 API 키를 발급받아 설정해주세요."
    );
  }
  return apiKey;
};

// 사업자 상태 코드 매핑
const BUSINESS_STATUS_MAP: Record<string, string> = {
  "01": "계속사업자",
  "02": "휴업자",
  "03": "폐업자",
};

// 과세 유형 코드 매핑
const TAX_TYPE_MAP: Record<string, string> = {
  "01": "부가가치세 일반과세자",
  "02": "부가가치세 간이과세자",
  "03": "부가가치세 과세특례자",
  "04": "부가가치세 면세사업자",
  "05": "수익사업을 영위하지 않는 비영리법인이거나 고유번호가 부여된 단체",
  "06": "고유번호가 부여된 단체",
  "07": "부가가치세 간이과세자(세금계산서 발급사업자)",
  "99": "해당없음",
};

// API 요청 함수
async function callNtsApi(endpoint: string, body: object): Promise<any> {
  const apiKey = getApiKey();
  const url = `${API_BASE_URL}/${endpoint}?serviceKey=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new McpError(
      ErrorCode.InternalError,
      `API 요청 실패: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  return response.json();
}

// 상태조회 결과 포맷팅
function formatStatusResult(data: any[]): string {
  if (!data || data.length === 0) {
    return "조회 결과가 없습니다.";
  }

  return data
    .map((item, index) => {
      const statusName = BUSINESS_STATUS_MAP[item.b_stt_cd] || item.b_stt || "알 수 없음";
      const taxTypeName = TAX_TYPE_MAP[item.tax_type_cd] || item.tax_type || "알 수 없음";

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

// 진위확인 결과 포맷팅
function formatValidateResult(data: any[]): string {
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

      // 요청 정보 표시
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

// MCP 서버 생성
const server = new Server(
  {
    name: "nts-bizinfo-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 도구 목록 핸들러
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "check_business_status",
        description:
          "사업자등록번호로 사업자의 영업상태(계속/휴업/폐업)와 과세유형을 조회합니다. 최대 100개까지 한 번에 조회 가능합니다.",
        inputSchema: {
          type: "object" as const,
          properties: {
            business_numbers: {
              type: "array",
              items: {
                type: "string",
              },
              description:
                "조회할 사업자등록번호 목록 (하이픈 없이 10자리 숫자, 예: ['1234567890']). 최대 100개",
              minItems: 1,
              maxItems: 100,
            },
          },
          required: ["business_numbers"],
        },
      },
      {
        name: "validate_business_registration",
        description:
          "사업자등록정보의 진위여부를 확인합니다. 사업자등록번호, 개업일자, 대표자명 등을 입력하여 국세청 정보와 일치하는지 확인합니다.",
        inputSchema: {
          type: "object" as const,
          properties: {
            businesses: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  b_no: {
                    type: "string",
                    description: "사업자등록번호 (하이픈 없이 10자리)",
                  },
                  start_dt: {
                    type: "string",
                    description: "개업일자 (YYYYMMDD 형식)",
                  },
                  p_nm: {
                    type: "string",
                    description: "대표자명",
                  },
                  p_nm2: {
                    type: "string",
                    description: "대표자명2 (공동대표인 경우)",
                  },
                  b_nm: {
                    type: "string",
                    description: "상호(법인명)",
                  },
                  corp_no: {
                    type: "string",
                    description: "법인등록번호 (하이픈 없이 13자리)",
                  },
                  b_sector: {
                    type: "string",
                    description: "주업태",
                  },
                  b_type: {
                    type: "string",
                    description: "주종목",
                  },
                },
                required: ["b_no", "start_dt", "p_nm"],
              },
              description: "진위확인할 사업자 정보 목록. 최대 100개",
              minItems: 1,
              maxItems: 100,
            },
          },
          required: ["businesses"],
        },
      },
    ],
  };
});

// 도구 실행 핸들러
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "check_business_status": {
        const businessNumbers = (args as { business_numbers: string[] }).business_numbers;

        if (!businessNumbers || businessNumbers.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, "사업자등록번호를 입력해주세요.");
        }

        if (businessNumbers.length > 100) {
          throw new McpError(ErrorCode.InvalidParams, "한 번에 최대 100개까지만 조회할 수 있습니다.");
        }

        // 사업자번호 형식 정리 (하이픈 제거)
        const cleanNumbers = businessNumbers.map((num) => num.replace(/-/g, ""));

        const result = await callNtsApi("status", { b_no: cleanNumbers });

        let response = `## 사업자등록 상태조회 결과\n`;
        response += `요청 건수: ${result.request_cnt || businessNumbers.length}건\n`;
        response += `조회 성공: ${result.match_cnt || 0}건\n`;
        response += formatStatusResult(result.data);

        return {
          content: [{ type: "text", text: response }],
        };
      }

      case "validate_business_registration": {
        const businesses = (args as { businesses: any[] }).businesses;

        if (!businesses || businesses.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, "진위확인할 사업자 정보를 입력해주세요.");
        }

        if (businesses.length > 100) {
          throw new McpError(ErrorCode.InvalidParams, "한 번에 최대 100개까지만 확인할 수 있습니다.");
        }

        // 사업자번호 형식 정리
        const cleanBusinesses = businesses.map((biz) => ({
          ...biz,
          b_no: biz.b_no.replace(/-/g, ""),
          corp_no: biz.corp_no ? biz.corp_no.replace(/-/g, "") : undefined,
        }));

        const result = await callNtsApi("validate", { businesses: cleanBusinesses });

        let response = `## 사업자등록정보 진위확인 결과\n`;
        response += `요청 건수: ${result.request_cnt || businesses.length}건\n`;
        response += `확인 완료: ${result.valid_cnt || 0}건\n`;
        response += formatValidateResult(result.data);

        return {
          content: [{ type: "text", text: response }],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `알 수 없는 도구입니다: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `도구 실행 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

// 서버 시작
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("NTS BizInfo MCP Server 시작됨");
}

main().catch((error) => {
  console.error("서버 시작 실패:", error);
  process.exit(1);
});
