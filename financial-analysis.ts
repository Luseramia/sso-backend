import { Elysia, t } from "elysia";
import FinancialAnalysisService from "./services/financial-analysis/financial-analysis.service";

const service = new FinancialAnalysisService();

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
});

const rowBody = t.Object({
  originalLabel: t.String({ minLength: 1 }),
  canonicalCode: t.Optional(t.Union([t.String(), t.Null()])),
  confidence: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
  mappingSource: t.Optional(t.String()),
  sourceRow: t.Number({ minimum: 1 }),
  values: t.Array(valueBody, { minItems: 1 }),
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
          }),
        },
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
      ),
);
