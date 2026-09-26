import { afterEach, describe, expect, mock, test } from "bun:test";
import FinancialOrchestratorClient from "./financial-orchestrator.client";

const originalFetch = globalThis.fetch;
const originalUrl = process.env.AI_ORCHESTRATOR_REST_URL;
const originalTimeout = process.env.AI_ORCHESTRATOR_TIMEOUT_MS;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.AI_ORCHESTRATOR_REST_URL;
  else process.env.AI_ORCHESTRATOR_REST_URL = originalUrl;
  if (originalTimeout === undefined) delete process.env.AI_ORCHESTRATOR_TIMEOUT_MS;
  else process.env.AI_ORCHESTRATOR_TIMEOUT_MS = originalTimeout;
});

describe("FinancialOrchestratorClient", () => {
  test("calls the internal normalizer without forwarding credentials", async () => {
    process.env.AI_ORCHESTRATOR_REST_URL = "http://ai-orchestrator.codex.svc.cluster.local:8000/";
    process.env.AI_ORCHESTRATOR_TIMEOUT_MS = "1000";
    const fetchMock = mock(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe(
        "http://ai-orchestrator.codex.svc.cluster.local:8000/financial-statements/normalize",
      );
      expect(init?.headers).toEqual({ "content-type": "application/json" });
      expect(JSON.parse(String(init?.body)).preferredScope).toBe("CONSOLIDATED");
      return new Response(JSON.stringify({
        status: "COMPLETED",
        statementType: "BALANCE_SHEET",
        scope: "CONSOLIDATED",
        currency: "THB",
        unit: "THOUSAND",
        rows: [],
        warnings: [],
        requiresHumanReview: true,
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await new FinancialOrchestratorClient().normalize({
      fileName: "statement.xlsx",
      statementType: "BALANCE_SHEET",
      preferredScope: "CONSOLIDATED",
      sheets: [{ name: "BS", rows: [["รายการ", "2569"]] }],
    });

    expect(result.status).toBe("COMPLETED");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("sends only structured analysis data to the summary endpoint", async () => {
    process.env.AI_ORCHESTRATOR_REST_URL = "http://127.0.0.1:18000";
    const fetchMock = mock(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("http://127.0.0.1:18000/financial-analysis/summarize");
      expect(init?.headers).toEqual({ "content-type": "application/json" });
      const body = JSON.parse(String(init?.body));
      expect(body.latestPeriod.metrics.totalAssets).toBe(120);
      expect(body).not.toHaveProperty("rows");
      return new Response(JSON.stringify({
        status: "COMPLETED",
        summaryMarkdown: "สินทรัพย์เพิ่มขึ้นตามข้อมูลที่ตรวจสอบแล้ว",
        evidenceKeys: ["latestPeriod.metrics.totalAssets"],
        warnings: [],
        requiresHumanReview: true,
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await new FinancialOrchestratorClient().summarize({
      companyName: "Example PCL",
      currency: "THB",
      latestPeriod: { periodEnd: "2026-06-30", metrics: { totalAssets: 120 } },
      growth: { assets: 20 },
      directions: [],
      signals: [],
      deterministicSummary: "Assets increased.",
    });

    expect(result.evidenceKeys).toEqual(["latestPeriod.metrics.totalAssets"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
