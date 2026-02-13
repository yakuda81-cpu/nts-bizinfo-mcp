#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

import { MAX_BUSINESS_NUMBERS, type NtsStatusResponse, type NtsValidateResponse } from "./types.js";
import { validateBusinessNumbers, validateBusinessInfos, validateHolidayParams } from "./validation.js";
import { callNtsApi, formatStatusResult, formatValidateResult } from "./nts-api.js";
import { getHolidaysForMonths } from "./kasi-api.js";

// ============================================================
// MCP 서버 설정
// ============================================================

const server = new Server(
  { name: "korea-opendata-mcp", version: "1.1.0" },
  { capabilities: { tools: {} } }
);

// 도구 목록 핸들러
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "check_business_status",
      description:
        `사업자등록번호로 사업자의 영업상태(계속/휴업/폐업)와 과세유형을 조회합니다. 최대 ${MAX_BUSINESS_NUMBERS}개까지 한 번에 조회 가능합니다.`,
      inputSchema: {
        type: "object" as const,
        properties: {
          business_numbers: {
            type: "array",
            items: { type: "string" },
            description:
              `조회할 사업자등록번호 목록 (하이픈 없이 10자리 숫자, 예: ['1234567890']). 최대 ${MAX_BUSINESS_NUMBERS}개`,
            minItems: 1,
            maxItems: MAX_BUSINESS_NUMBERS,
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
                b_no: { type: "string", description: "사업자등록번호 (하이픈 없이 10자리)" },
                start_dt: { type: "string", description: "개업일자 (YYYYMMDD 형식)" },
                p_nm: { type: "string", description: "대표자명" },
                p_nm2: { type: "string", description: "대표자명2 (공동대표인 경우)" },
                b_nm: { type: "string", description: "상호(법인명)" },
                corp_no: { type: "string", description: "법인등록번호 (하이픈 없이 13자리)" },
                b_sector: { type: "string", description: "주업태" },
                b_type: { type: "string", description: "주종목" },
              },
              required: ["b_no", "start_dt", "p_nm"],
            },
            description: `진위확인할 사업자 정보 목록. 최대 ${MAX_BUSINESS_NUMBERS}개`,
            minItems: 1,
            maxItems: MAX_BUSINESS_NUMBERS,
          },
        },
        required: ["businesses"],
      },
    },
    {
      name: "get_korean_holidays",
      description:
        "한국의 공휴일, 국경일, 기념일, 24절기, 잡절 정보를 조회합니다. 특정 연도와 월의 특일 정보를 가져올 수 있습니다.",
      inputSchema: {
        type: "object" as const,
        properties: {
          type: {
            type: "string",
            enum: ["holidays", "nationalDay", "anniversary", "divisionsInfo", "sundryDay"],
            description:
              "조회할 특일 종류: holidays(공휴일), nationalDay(국경일), anniversary(기념일), divisionsInfo(24절기), sundryDay(잡절)",
          },
          year: { type: "number", description: "조회할 연도 (예: 2025)" },
          month: {
            type: "number",
            description: "조회할 시작 월 (1-12). 생략하면 해당 연도 전체를 조회합니다.",
            minimum: 1,
            maximum: 12,
          },
          monthCount: {
            type: "number",
            description: "조회할 월 수 (기본값: 1). month가 지정된 경우에만 유효합니다.",
            minimum: 1,
            maximum: 12,
          },
        },
        required: ["type", "year"],
      },
    },
  ],
}));

// 도구 실행 핸들러
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "check_business_status": {
        const cleanNumbers = validateBusinessNumbers(
          (args as Record<string, unknown>).business_numbers
        );
        const result = await callNtsApi("status", { b_no: cleanNumbers }) as NtsStatusResponse;

        let text = "## 사업자등록 상태조회 결과\n";
        text += `요청 건수: ${result.request_cnt ?? cleanNumbers.length}건\n`;
        text += `조회 성공: ${result.match_cnt ?? 0}건\n`;
        text += formatStatusResult(result.data);

        return { content: [{ type: "text", text }] };
      }

      case "validate_business_registration": {
        const cleanBusinesses = validateBusinessInfos(
          (args as Record<string, unknown>).businesses
        );
        const result = await callNtsApi("validate", { businesses: cleanBusinesses }) as NtsValidateResponse;

        let text = "## 사업자등록정보 진위확인 결과\n";
        text += `요청 건수: ${result.request_cnt ?? cleanBusinesses.length}건\n`;
        text += `확인 완료: ${result.valid_cnt ?? 0}건\n`;
        text += formatValidateResult(result.data);

        return { content: [{ type: "text", text }] };
      }

      case "get_korean_holidays": {
        const { type, year, month, monthCount } = validateHolidayParams(
          args as Record<string, unknown>
        );

        const text = month
          ? await getHolidaysForMonths(type, year, month, monthCount)
          : await getHolidaysForMonths(type, year, 1, 12);

        return { content: [{ type: "text", text }] };
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

// 서버 시작
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Korea OpenData MCP Server 시작됨");
}

main().catch((error) => {
  console.error("서버 시작 실패:", error);
  process.exit(1);
});
