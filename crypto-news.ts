import { Elysia, t } from "elysia";
import CryptoNewsService from "./services/crypto-news/crypto-news.service";

const cryptoNewsService = new CryptoNewsService();

export const cryptoNewsController = new Elysia().group(
  "/crypto-news",
  (app) =>
    app
      .get(
        "/list",
        async ({ query, set }) => {
          try {
            const data = await cryptoNewsService.list({
              sentiment: query.sentiment || undefined,
              credibility: query.credibility || undefined,
              coin: query.coin || undefined,
              search: query.search || undefined,
              minScore: query.minScore ? Number(query.minScore) : undefined,
              limit: query.limit ? Number(query.limit) : undefined,
            });
            return data;
          } catch (error: any) {
            console.error("crypto-news list error", error);
            set.status = 500;
            return { error: error.message || "failed to fetch" };
          }
        },
        {
          query: t.Object({
            sentiment: t.Optional(t.String()),
            credibility: t.Optional(t.String()),
            coin: t.Optional(t.String()),
            search: t.Optional(t.String()),
            minScore: t.Optional(t.String()),
            limit: t.Optional(t.String()),
          }),
        },
      )
      .get("/filters", async ({ set }) => {
        try {
          const [sentiments, credibilities, coins] = await Promise.all([
            cryptoNewsService.distinctSentiments(),
            cryptoNewsService.distinctCredibilities(),
            cryptoNewsService.distinctCoins(),
          ]);
          return { sentiments, credibilities, coins };
        } catch (error: any) {
          console.error("crypto-news filters error", error);
          set.status = 500;
          return { error: error.message || "failed to fetch filters" };
        }
      })
      .delete(
        "/:id",
        async ({ params, set }) => {
          try {
            const data = await cryptoNewsService.softDelete(Number(params.id));
            return { message: "deleted", data };
          } catch (error: any) {
            console.error("crypto-news delete error", error);
            set.status = 500;
            return { error: error.message || "failed to delete" };
          }
        },
        { params: t.Object({ id: t.String() }) },
      ),
);
