import { describe, expect, test } from "bun:test";
import {
  autoMap,
  buildAnalysis,
  calculateMetrics,
  normalizeLabel,
  validate,
} from "./financial-analysis.service";

describe("financial analysis deterministic engine", () => {
  test("normalizes and maps English and Thai account labels", () => {
    expect(normalizeLabel("Cash & Cash Equivalents")).toBe("cash and cash equivalents");
    expect(autoMap("Cash & Cash Equivalents").canonicalCode).toBe("ASSET.CASH");
    expect(autoMap("ลูกหนี้การค้า").canonicalCode).toBe("ASSET.RECEIVABLE");
  });

  test("calculates current ratio from known input", () => {
    const metrics = calculateMetrics({
      "ASSET.CURRENT": 100,
      "LIABILITY.CURRENT": 50,
      "ASSET.TOTAL": 180,
      "LIABILITY.TOTAL": 80,
      "EQUITY.TOTAL": 100,
    });
    expect(metrics.currentRatio).toBe(2);
    expect(metrics.equityToAssets).toBeCloseTo(100 / 180);
  });

  test("validates the accounting equation with configured tolerance", () => {
    expect(validate({ "ASSET.TOTAL": 100, "LIABILITY.TOTAL": 40, "EQUITY.TOTAL": 60 }).status).toBe("PASS");
    expect(validate({ "ASSET.TOTAL": 100, "LIABILITY.TOTAL": 40, "EQUITY.TOTAL": 58.5 }).status).toBe("WARNING");
    expect(validate({ "ASSET.TOTAL": 100, "LIABILITY.TOTAL": 40, "EQUITY.TOTAL": 55 }).status).toBe("FAIL");
  });

  test("emits evidence when leverage increases materially", () => {
    const analysis = buildAnalysis([
      {
        periodEnd: "2025-12-31",
        fiscalYear: 2025,
        values: {
          "ASSET.TOTAL": 180,
          "ASSET.CASH": 20,
          "LIABILITY.TOTAL": 80,
          "LIABILITY.LONG_TERM_DEBT": 50,
          "EQUITY.TOTAL": 100,
        },
        sources: {},
      },
      {
        periodEnd: "2026-12-31",
        fiscalYear: 2026,
        values: {
          "ASSET.TOTAL": 210,
          "ASSET.CASH": 18,
          "LIABILITY.TOTAL": 110,
          "LIABILITY.LONG_TERM_DEBT": 75,
          "EQUITY.TOTAL": 100,
        },
        sources: {},
      },
    ]);
    expect(analysis.signals.some((signal) => signal.id === "INCREASING_LEVERAGE")).toBe(true);
    expect(analysis.signals.find((signal) => signal.id === "INCREASING_LEVERAGE")?.evidence.length).toBeGreaterThan(0);
  });
});
