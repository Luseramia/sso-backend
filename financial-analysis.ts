import { Elysia, t } from "elysia";
import FinancialAnalysisService from "./services/financial-analysis/financial-analysis.service";
import FinancialOrchestratorClient from "./services/financial-analysis/financial-orchestrator.client";

const service = new FinancialAnalysisService();
const orchestrator = new FinancialOrchestratorClient();

function getUserIdFromAuth(authHeader: string | undefined): number | null {
  if (!authHeader) return null;
  try {
    const token = authHeader.split(" ")[1]?.split(".")[0];
    if (!token) return null;
    return JSON.parse(Buffer.from(token, "base64").toString("utf-8")).id ?? null;
  } catch {
    return null;
  }
}

const valueBody = t.Object({
  periodEnd: t.String(),
  value: t.Number(),
  originalValue: t.String(),
  sourceColumn: t.Optional(t.Number({ minimum: 1 })),
});

const rowBody = t.Object({
  originalLabel: t.String({ minLength: 1 }),
  canonicalCode: t.Optional(t.Union([t.String(), t.Null()])),
  confidence: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
  mappingSource: t.Optional(t.String()),
  sourceSheet: t.Optional(t.String()),
  sourceRow: t.Number({ minimum: 1 }),
  values: t.Array(valueBody, { minItems: 1 }),
});

const workbookSheetBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  rows: t.Array(
    t.Array(t.Union([
      t.String(),
      t.Number(),
      t.Boolean(),
      t.Null(),
    ]), { maxItems: 100 }),
    { maxItems: 500 },
  ),
});

const respond = async (
  headers: Record<string, string | undefined>,
  set: { status?: number | string },
  action: (userId: number) => Promise<unknown>,
) => {
  const userId = getUserIdFromAuth(headers.authorization);
  if (!userId) {
    set.status = 401;
    return { error: "unauthorized" };
  }
  try {
    return { data: await action(userId) };
  } catch (error: any) {
    console.error("financial-analysis error", error);
    set.status = error.message === "company not found" ? 404 : 400;
    return { error: error.message || "financial analysis request failed" };
  }
};

export const financialAnalysisController = new Elysia().group(
  "/financial-analysis",
  (app) =>
    app
      .get("/accounts", async ({ headers, set }) =>
        respond(headers, set, async () => service.accounts()),
      )
      .get("/companies", async ({ headers, set }) =>
        respond(headers, set, (userId) => service.listCompanies(userId)),
      )
      .post(
        "/companies",
        async ({ body, headers, set }) =>
          respond(headers, set, (userId) => service.createCompany(userId, body)),
        {
          body: t.Object({
            name: t.String({ minLength: 1, maxLength: 240 }),
            ticker: t.Optional(t.String({ maxLength: 30 })),
            market: t.Optional(t.String({ maxLength: 80 })),
            industry: t.Optional(t.String({ maxLength: 160 })),
            sector: t.Optional(t.String({ maxLength: 160 })),
            country: t.Optional(t.String({ maxLength: 80 })),
            defaultCurrency: t.Optional(t.String({ maxLength: 10 })),
          }),
        },
      )
      .post(
        "/ai-preview",
        async ({ body, headers, set }) =>
          respond(headers, set, async (userId) => {
            const normalized = await orchestrator.normalize({
              fileName: body.fileName,
              statementType: "BALANCE_SHEET",
              preferredScope: body.preferredScope,
              currencyHint: body.currencyHint,
              unitHint: body.unitHint,
              sheets: body.sheets,
            });
            if (normalized.status !== "COMPLETED" || normalized.rows.length === 0) {
              throw new Error(
                normalized.warnings.join("; ") ||
                  "AI could not normalize this financial statement",
              );
            }
            const preview = await service.preview(
              userId,
              body.companyId,
              normalized.rows,
              normalized.unit,
            );
            return {
              ...preview,
              currency: normalized.currency,
              unit: normalized.unit,
              scope: normalized.scope,
              normalizationWarnings: normalized.warnings,
              requiresHumanReview: true,
            };
          }),
        {
          body: t.Object({
            companyId: t.Number({ minimum: 1 }),
            fileName: t.String({ minLength: 1, maxLength: 500 }),
            preferredScope: t.Union([
              t.Literal("CONSOLIDATED"),
              t.Literal("SEPARATE"),
            ]),
            currencyHint: t.Optional(t.String({ minLength: 3, maxLength: 10 })),
            unitHint: t.Optional(t.Union([
              t.Literal("ONES"),
              t.Literal("THOUSAND"),
              t.Literal("MILLION"),
              t.Literal("BILLION"),
            ])),
            sheets: t.Array(workbookSheetBody, { minItems: 1, maxItems: 50 }),
          }),
        },
      )
      .post(
        "/preview",
        async ({ body, headers, set }) =>
          respond(headers, set, (userId) =>
            service.preview(userId, body.companyId, body.rows, body.unit),
          ),
        {
          body: t.Object({
            companyId: t.Number({ minimum: 1 }),
            unit: t.Union([
              t.Literal("ONES"),
              t.Literal("THOUSAND"),
              t.Literal("MILLION"),
              t.Literal("BILLION"),
            ]),
            rows: t.Array(rowBody, { minItems: 1 }),
          }),
        },
      )
      .post(
        "/import",
        async ({ body, headers, set }) =>
          respond(headers, set, (userId) => service.import(userId, body)),
        {
          body: t.Object({
            companyId: t.Number({ minimum: 1 }),
            fileName: t.String({ minLength: 1, maxLength: 500 }),
            fileType: t.String({ minLength: 1, maxLength: 30 }),
            currency: t.String({ minLength: 3, maxLength: 10 }),
            unit: t.Union([
              t.Literal("ONES"),
              t.Literal("THOUSAND"),
              t.Literal("MILLION"),
              t.Literal("BILLION"),
            ]),
            rows: t.Array(rowBody, { minItems: 1 }),
            rawSource: t.Optional(t.Object({
              scope: t.Union([
                t.Literal("CONSOLIDATED"),
                t.Literal("SEPARATE"),
              ]),
              sheets: t.Array(workbookSheetBody, { minItems: 1, maxItems: 50 }),
            })),
          }),
        },
      )
      .get(
        "/documents/:id/source",
        async ({ params, headers, set }) =>
          respond(headers, set, (userId) => service.source(userId, Number(params.id))),
        { params: t.Object({ id: t.Numeric() }) },
      )
      .get(
        "/companies/:id/dashboard",
        async ({ params, headers, set }) =>
          respond(headers, set, (userId) => service.dashboard(userId, Number(params.id))),
        { params: t.Object({ id: t.Numeric() }) },
      )
      .get(
        "/companies/:id/balance-sheet",
        async ({ params, headers, set }) =>
          respond(headers, set, async (userId) => {
            const dashboard = await service.dashboard(userId, Number(params.id));
            return { company: dashboard.company, accounts: dashboard.accounts, periods: dashboard.periods, documents: dashboard.documents };
          }),
        { params: t.Object({ id: t.Numeric() }) },
      )
      .get(
        "/companies/:id/financial-metrics",
        async ({ params, headers, set }) =>
          respond(headers, set, async (userId) => {
            const dashboard = await service.dashboard(userId, Number(params.id));
            return dashboard.periods.map((period) => ({ periodEnd: period.periodEnd, metrics: period.metrics }));
          }),
        { params: t.Object({ id: t.Numeric() }) },
      )
      .get(
        "/companies/:id/financial-trends",
        async ({ params, headers, set }) =>
          respond(headers, set, async (userId) => {
            const dashboard = await service.dashboard(userId, Number(params.id));
            return { directions: dashboard.directions, growth: dashboard.growth };
          }),
        { params: t.Object({ id: t.Numeric() }) },
      )
      .get(
        "/companies/:id/financial-signals",
        async ({ params, headers, set }) =>
          respond(headers, set, async (userId) => (await service.dashboard(userId, Number(params.id))).signals),
        { params: t.Object({ id: t.Numeric() }) },
      )
      .get(
        "/companies/:id/financial-summary",
        async ({ params, headers, set }) =>
          respond(headers, set, async (userId) => {
            const dashboard = await service.dashboard(userId, Number(params.id));
            return { summary: dashboard.summary, source: "DETERMINISTIC_METRICS", signals: dashboard.signals.map((signal) => signal.id) };
          }),
        { params: t.Object({ id: t.Numeric() }) },
      )
      .post(
        "/companies/:id/financial-summary",
        async ({ params, headers, set }) =>
          respond(headers, set, async (userId) => {
            const dashboard = await service.dashboard(userId, Number(params.id));
            const latest = dashboard.periods.at(-1);
            if (!latest) throw new Error("financial data not found");
            const previous = dashboard.periods.at(-2);
            return orchestrator.summarize({
              companyName: dashboard.company.name,
              currency: dashboard.company.default_currency,
              latestPeriod: {
                periodEnd: latest.periodEnd,
                metrics: latest.metrics,
              },
              previousPeriod: previous
                ? { periodEnd: previous.periodEnd, metrics: previous.metrics }
                : undefined,
              growth: { ...(dashboard.growth ?? {}) },
              directions: dashboard.directions.map((item) => ({ ...item })),
              signals: dashboard.signals.map((item) => ({ ...item })),
              deterministicSummary: dashboard.summary,
            });
          }),
        { params: t.Object({ id: t.Numeric() }) },
      ),
);
