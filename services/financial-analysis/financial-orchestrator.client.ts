import type { Unit } from "./financial-analysis.service";

export type FinancialScope = "CONSOLIDATED" | "SEPARATE";
export type WorkbookCell = string | number | boolean | null;

export interface WorkbookSheet {
  name: string;
  rows: WorkbookCell[][];
}

export interface FinancialNormalizationRequest {
  fileName: string;
  statementType: "BALANCE_SHEET";
  preferredScope: FinancialScope;
  currencyHint?: string;
  unitHint?: Unit;
  sheets: WorkbookSheet[];
}

export interface FinancialNormalizationResponse {
  status: "COMPLETED" | "FAILED";
  statementType: "BALANCE_SHEET";
  scope: FinancialScope;
  currency: string;
  unit: Unit;
  rows: Array<{
    originalLabel: string;
    canonicalCode: string | null;
    confidence: number;
    mappingSource: "AI";
    sourceSheet: string;
    sourceRow: number;
    values: Array<{
      periodEnd: string;
      value: number;
      originalValue: string;
      sourceColumn: number;
    }>;
  }>;
  warnings: string[];
  requiresHumanReview: true;
}

const DEFAULT_ORCHESTRATOR_URL = "http://127.0.0.1:18000";
const DEFAULT_TIMEOUT_MS = 1_300_000;

export default class FinancialOrchestratorClient {
  async normalize(
    payload: FinancialNormalizationRequest,
  ): Promise<FinancialNormalizationResponse> {
    const controller = new AbortController();
    const timeoutMs = this.timeoutMs();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.normalizeUrl(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`AI orchestrator returned HTTP ${response.status}`);
      }
      const result = (await response.json()) as FinancialNormalizationResponse;
      if (
        !result ||
        !["COMPLETED", "FAILED"].includes(result.status) ||
        !["CONSOLIDATED", "SEPARATE"].includes(result.scope) ||
        !["ONES", "THOUSAND", "MILLION", "BILLION"].includes(result.unit) ||
        !Array.isArray(result.rows) ||
        !Array.isArray(result.warnings)
      ) {
        throw new Error("AI orchestrator returned an invalid financial statement response");
      }
      return result;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`AI orchestrator timed out after ${timeoutMs} ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizeUrl() {
    const baseUrl = (
      process.env.AI_ORCHESTRATOR_REST_URL?.trim() || DEFAULT_ORCHESTRATOR_URL
    ).replace(/\/+$/, "");
    return `${baseUrl}/financial-statements/normalize`;
  }

  private timeoutMs() {
    const configured = Number(process.env.AI_ORCHESTRATOR_TIMEOUT_MS);
    return Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_TIMEOUT_MS;
  }
}
