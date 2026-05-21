import dz from "../../drizzle.service";
import { cryptoNewsTable } from "../../db/crypto-news.schema";
import { and, desc, eq, isNull, sql, ilike, type SQL } from "drizzle-orm";

type CryptoNewsInsert = typeof cryptoNewsTable.$inferInsert;

export default class CryptoNewsService {
  async list(params: {
    sentiment?: string;
    credibility?: string;
    coin?: string;
    search?: string;
    minScore?: number;
    limit?: number;
  }) {
    try {
      const { sentiment, credibility, coin, search, minScore, limit } = params;

      const conds: SQL[] = [isNull(cryptoNewsTable.deleted_at)];
      if (sentiment) conds.push(eq(cryptoNewsTable.sentiment, sentiment));
      if (credibility) conds.push(eq(cryptoNewsTable.credibility, credibility));
      if (coin) {
        // coins_mentioned is jsonb array; check if value present
        conds.push(
          sql`${cryptoNewsTable.coins_mentioned} @> ${JSON.stringify([coin])}::jsonb`,
        );
      }
      if (search) conds.push(ilike(cryptoNewsTable.title, `%${search}%`));
      if (typeof minScore === "number") {
        conds.push(
          sql`${cryptoNewsTable.source_attribution_score} >= ${minScore}`,
        );
      }

      let query = dz
        .select()
        .from(cryptoNewsTable)
        .where(and(...conds))
        .orderBy(desc(cryptoNewsTable.analyzed_at));

      const data = limit
        ? await query.limit(limit)
        : await query.limit(200);

      return data;
    } catch (error) {
      console.log("crypto-news list error", error);
      throw error;
    }
  }

  async distinctSentiments() {
    try {
      const data = await dz
        .selectDistinct({ sentiment: cryptoNewsTable.sentiment })
        .from(cryptoNewsTable)
        .where(isNull(cryptoNewsTable.deleted_at));
      return data.map((d) => d.sentiment).filter(Boolean);
    } catch (error) {
      console.log("crypto-news distinctSentiments error", error);
      throw error;
    }
  }

  async distinctCredibilities() {
    try {
      const data = await dz
        .selectDistinct({ credibility: cryptoNewsTable.credibility })
        .from(cryptoNewsTable)
        .where(isNull(cryptoNewsTable.deleted_at));
      return data.map((d) => d.credibility).filter(Boolean);
    } catch (error) {
      console.log("crypto-news distinctCredibilities error", error);
      throw error;
    }
  }

  async distinctCoins() {
    try {
      const rows = await dz.execute<{ coin: string }>(
        sql`select distinct jsonb_array_elements_text(${cryptoNewsTable.coins_mentioned}) as coin
            from ${cryptoNewsTable}
            where ${cryptoNewsTable.deleted_at} is null
            order by coin`,
      );
      // drizzle execute returns { rows } for pg
      const rowArr = (rows as any).rows ?? rows;
      return (rowArr as Array<{ coin: string }>).map((r) => r.coin);
    } catch (error) {
      console.log("crypto-news distinctCoins error", error);
      throw error;
    }
  }

  async saveOne(row: CryptoNewsInsert) {
    try {
      const [data] = await dz
        .insert(cryptoNewsTable)
        .values(row)
        .returning();
      return data;
    } catch (error) {
      console.log("crypto-news saveOne error", error);
      throw error;
    }
  }

  async softDelete(id: number) {
    try {
      const data = await dz
        .update(cryptoNewsTable)
        .set({ deleted_at: sql`CURRENT_DATE` })
        .where(eq(cryptoNewsTable.id, id))
        .returning();
      return data[0];
    } catch (error) {
      console.log("crypto-news softDelete error", error);
      throw error;
    }
  }
}
