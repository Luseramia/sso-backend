import { Elysia, t } from "elysia";
import CryptoAnalysisService from "./services/crypto-analysis/crypto-analysis.service";

const cryptoAnalysisService = new CryptoAnalysisService();

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

export const cryptoAnalysisController = new Elysia().group(
  "/crypto-analysis",
  (app) =>
    app
      .post(
        "/save",
        async ({ body, set, headers }) => {
          const userId = getUserIdFromAuth(headers.authorization);
          if (!userId) {
            set.status = 401;
            return { error: "unauthorized" };
          }

          try {
            const saved = await cryptoAnalysisService.saveOne({
              ...body,
              analyzed_at: new Date(body.analyzed_at),
              create_by_user_id: userId,
            });
            return { message: "saved", data: saved };
          } catch (error: any) {
            console.error("crypto-analysis save error", error);
            set.status = 500;
            return { error: error.message || "failed to save" };
          }
        },
        {
          body: t.Object({
            analyzed_at: t.String(),
            coin: t.String(),
            timeframe: t.String(),

            trend: t.Optional(t.String()),
            trend_reason: t.Optional(t.String()),

            recommendation: t.Optional(t.String()),
            recommendation_reason: t.Optional(t.String()),
            entry_price: t.Optional(t.String()),
            stop_loss: t.Optional(t.String()),
            stop_loss_note: t.Optional(t.String()),
            target_1: t.Optional(t.String()),
            target_2: t.Optional(t.String()),

            resistance_1: t.Optional(t.String()),
            resistance_1_note: t.Optional(t.String()),
            resistance_2: t.Optional(t.String()),
            resistance_2_note: t.Optional(t.String()),
            support_1: t.Optional(t.String()),
            support_1_note: t.Optional(t.String()),
            support_2: t.Optional(t.String()),
            support_2_note: t.Optional(t.String()),

            rsi: t.Optional(t.String()),
            atr: t.Optional(t.String()),

            ema_note: t.Optional(t.String()),
            macd_note: t.Optional(t.String()),
            bollinger_note: t.Optional(t.String()),
            volume_note: t.Optional(t.String()),
            risk_note: t.Optional(t.String()),

            raw_text: t.String(),
          }),
        },
      )
      .get(
        "/list",
        async ({ query, set, headers }) => {
          const userId = getUserIdFromAuth(headers.authorization);
          if (!userId) {
            set.status = 401;
            return { error: "unauthorized" };
          }

          try {
            const data = await cryptoAnalysisService.list({
              userId,
              timeframe: query.timeframe || undefined,
              coin: query.coin || undefined,
            });
            return data;
          } catch (error: any) {
            console.error("crypto-analysis list error", error);
            set.status = 500;
            return { error: error.message || "failed to fetch" };
          }
        },
        {
          query: t.Object({
            timeframe: t.Optional(t.String()),
            coin: t.Optional(t.String()),
          }),
        },
      )
      .get("/filters", async ({ set, headers }) => {
        const userId = getUserIdFromAuth(headers.authorization);
        if (!userId) {
          set.status = 401;
          return { error: "unauthorized" };
        }
        try {
          const [timeframes, coins] = await Promise.all([
            cryptoAnalysisService.distinctTimeframes(userId),
            cryptoAnalysisService.distinctCoins(userId),
          ]);
          return { timeframes, coins };
        } catch (error: any) {
          console.error("crypto-analysis filters error", error);
          set.status = 500;
          return { error: error.message || "failed to fetch filters" };
        }
      })
      .delete(
        "/:id",
        async ({ params, set, headers }) => {
          const userId = getUserIdFromAuth(headers.authorization);
          if (!userId) {
            set.status = 401;
            return { error: "unauthorized" };
          }
          try {
            const data = await cryptoAnalysisService.softDelete(
              Number(params.id),
              userId,
            );
            return { message: "deleted", data };
          } catch (error: any) {
            console.error("crypto-analysis delete error", error);
            set.status = 500;
            return { error: error.message || "failed to delete" };
          }
        },
        {
          params: t.Object({ id: t.String() }),
        },
      ),
);
