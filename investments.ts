import { Elysia, t } from "elysia";
import InvestmentService from "./services/investment/investment.service";

const investmentService = new InvestmentService();

function getUserIdFromAuth(authHeader: string | undefined): number | null {
  if (!authHeader) return null;
  try {
    const token = authHeader.split(" ")[1]?.split(".")[0];
    if (!token) return null;
    const userData = Buffer.from(token, "base64").toString("utf-8");
    return JSON.parse(userData).id ?? null;
  } catch {
    return null;
  }
}

const holdingBody = t.Object({
  symbol: t.String({ minLength: 1, maxLength: 20 }),
  asset_name: t.String({ minLength: 1, maxLength: 200 }),
  asset_type: t.String({ minLength: 1, maxLength: 50 }),
  market: t.String({ maxLength: 100 }),
  quantity: t.Number({ minimum: 0 }),
  total_cost: t.Number({ minimum: 0 }),
  current_price: t.Number({ minimum: 0 }),
  currency: t.Optional(t.Union([t.Literal("THB"), t.Literal("USD")])),
  purchase_date: t.String(),
  notes: t.String({ maxLength: 2000 }),
});

export const investmentsController = new Elysia().group(
  "/investments",
  (app) =>
    app
      .get("/list", async ({ set, headers }) => {
        const userId = getUserIdFromAuth(headers.authorization);
        if (!userId) {
          set.status = 401;
          return { error: "unauthorized" };
        }
        try {
          return { data: await investmentService.list(userId) };
        } catch (error: any) {
          console.error("investment list error", error);
          set.status = 500;
          return { error: error.message || "failed to fetch investments" };
        }
      })
      .post(
        "/save",
        async ({ body, set, headers }) => {
          const userId = getUserIdFromAuth(headers.authorization);
          if (!userId) {
            set.status = 401;
            return { error: "unauthorized" };
          }
          if (body.quantity <= 0 || body.total_cost <= 0) {
            set.status = 400;
            return { error: "quantity and total cost must be greater than zero" };
          }
          try {
            const data = await investmentService.create({
              symbol: body.symbol.trim().toUpperCase(),
              asset_name: body.asset_name.trim(),
              asset_type: body.asset_type,
              market: body.market.trim() || "ไม่ระบุ",
              quantity: String(body.quantity),
              total_cost: String(body.total_cost),
              current_price: String(body.current_price),
              currency: body.currency ?? "THB",
              purchase_date: body.purchase_date,
              notes: body.notes.trim() || null,
              create_by_user_id: userId,
            });
            return { message: "saved", data };
          } catch (error: any) {
            console.error("investment save error", error);
            set.status = 500;
            return { error: error.message || "failed to save investment" };
          }
        },
        { body: holdingBody },
      )
      .put(
        "/:id",
        async ({ params, body, set, headers }) => {
          const userId = getUserIdFromAuth(headers.authorization);
          if (!userId) {
            set.status = 401;
            return { error: "unauthorized" };
          }
          if (body.quantity <= 0 || body.total_cost <= 0) {
            set.status = 400;
            return { error: "quantity and total cost must be greater than zero" };
          }
          try {
            const data = await investmentService.update(Number(params.id), userId, {
              symbol: body.symbol.trim().toUpperCase(),
              asset_name: body.asset_name.trim(),
              asset_type: body.asset_type,
              market: body.market.trim() || "ไม่ระบุ",
              quantity: String(body.quantity),
              total_cost: String(body.total_cost),
              current_price: String(body.current_price),
              ...(body.currency ? { currency: body.currency } : {}),
              purchase_date: body.purchase_date,
              notes: body.notes.trim() || null,
            });
            if (!data) {
              set.status = 404;
              return { error: "investment not found" };
            }
            return { message: "updated", data };
          } catch (error: any) {
            console.error("investment update error", error);
            set.status = 500;
            return { error: error.message || "failed to update investment" };
          }
        },
        { params: t.Object({ id: t.Numeric() }), body: holdingBody },
      )
      .delete(
        "/:id",
        async ({ params, set, headers }) => {
          const userId = getUserIdFromAuth(headers.authorization);
          if (!userId) {
            set.status = 401;
            return { error: "unauthorized" };
          }
          try {
            const data = await investmentService.remove(Number(params.id), userId);
            if (!data) {
              set.status = 404;
              return { error: "investment not found" };
            }
            return { message: "deleted" };
          } catch (error: any) {
            console.error("investment delete error", error);
            set.status = 500;
            return { error: error.message || "failed to delete investment" };
          }
        },
        { params: t.Object({ id: t.Numeric() }) },
      ),
);
