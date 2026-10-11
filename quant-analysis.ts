import { Elysia, t } from "elysia";
import QuantService, { QuantError } from "./services/quant/quant.service";
import PostgresQuantRepository from "./services/quant/quant.repository";

/** Signature verification is supplied by the existing index.ts tokenChecker guard. */
function authenticatedUserId(header?: string): number {
  try {
    if (!header?.startsWith("Bearer ")) throw new Error();
    const encoded = header.slice(7).split(".")[0];
    const id = JSON.parse(Buffer.from(encoded ?? "", "base64").toString("utf8")).id;
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error();
    return id;
  } catch { throw new QuantError(401, "กรุณาเข้าสู่ระบบก่อนใช้งาน Quant Lab"); }
}

const settingsBody = t.Object({
  lookback: t.Integer({ minimum: 5, maximum: 252 }), trainingPercent: t.Number({ minimum: 40, maximum: 80 }),
  entryZ: t.Number({ exclusiveMinimum: 0, maximum: 20 }), exitZ: t.Number({ minimum: 0, maximum: 20 }),
  stopZ: t.Number({ exclusiveMinimum: 0, maximum: 20 }), maxHoldingDays: t.Integer({ minimum: 1, maximum: 252 }),
  feeBps: t.Number({ minimum: 0, maximum: 100 }), slippageBps: t.Number({ minimum: 0, maximum: 100 }),
  borrowPercent: t.Number({ minimum: 0, maximum: 100 }), capital: t.Number({ minimum: 100, maximum: 1e9 }),
  requireCointegration: t.Boolean(),
});

export function createQuantController(service: QuantService) {
  return new Elysia({ prefix: "/quant" })
    .onError(({ error, code, set }) => {
      if (error instanceof QuantError) { set.status = error.status; return { error: error.message }; }
      if (code === "VALIDATION") { set.status = 400; return { error: "ข้อมูลหรือพารามิเตอร์ไม่ถูกต้อง" }; }
      set.status = 500;
      // Do not return SQL errors, credentials, request bodies, or provider URLs to the client/logs.
      return { error: "ระบบจัดเก็บ Quant Lab ไม่พร้อมใช้งาน กรุณาตรวจสอบฐานข้อมูลและ migration" };
    })
    .get("/runs", async ({ headers }) => ({ data: await service.list(authenticatedUserId(headers.authorization)) }))
    .get("/runs/:id", async ({ headers, params }) => ({ data: await service.get(authenticatedUserId(headers.authorization), params.id) }), {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
    })
    .get("/market-data", async ({ headers }) => ({ data: await service.listPrices(authenticatedUserId(headers.authorization)) }))
    .get("/market-data/:id", async ({ headers, params }) => ({ data: await service.storedPrices(authenticatedUserId(headers.authorization), params.id) }), {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
    })
    .post("/market-data", async ({ headers, body }) => ({ data: await service.prices(authenticatedUserId(headers.authorization), body) }), {
      body: t.Object({ symbol: t.String({ minLength: 1, maxLength: 15 }), count: t.Integer({ minimum: 100, maximum: 2000 }),
        refresh: t.Optional(t.Boolean()), apiKey: t.Optional(t.String({ maxLength: 256 })) }),
    })
    .post("/runs", async ({ headers, body, set }) => {
      const data = await service.save(authenticatedUserId(headers.authorization), body);
      set.status = 201;
      return { data };
    }, {
      body: t.Object({ snapshotA: t.String({ format: "uuid" }), snapshotB: t.String({ format: "uuid" }),
        settings: settingsBody, name: t.Optional(t.String({ maxLength: 120 })) }),
    });
}

export const quantAnalysisController = createQuantController(new QuantService(new PostgresQuantRepository()));
