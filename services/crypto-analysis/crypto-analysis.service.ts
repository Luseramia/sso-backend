import dz from "../../drizzle.service";
import { cryptoAnalysisTable } from "../../db/crypto-analysis.schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

type CryptoAnalysisInsert = typeof cryptoAnalysisTable.$inferInsert;

export default class CryptoAnalysisService {
  async saveOne(row: CryptoAnalysisInsert) {
    try {
      const [data] = await dz
        .insert(cryptoAnalysisTable)
        .values(row)
        .returning();
      return data;
    } catch (error) {
      console.log("crypto-analysis saveOne error", error);
      throw error;
    }
  }

  async list(params: {
    userId: number;
    timeframe?: string;
    coin?: string;
  }) {
    try {
      const { userId, timeframe, coin } = params;
      const conds = [
        // eq(cryptoAnalysisTable.create_by_user_id, userId),
        isNull(cryptoAnalysisTable.deleted_at),
      ];
      if (timeframe) conds.push(eq(cryptoAnalysisTable.timeframe, timeframe));
      if (coin) conds.push(eq(cryptoAnalysisTable.coin, coin));

      const data = await dz
        .select()
        .from(cryptoAnalysisTable)
        .where(and(...conds))
        .orderBy(desc(cryptoAnalysisTable.analyzed_at));

      return data;
    } catch (error) {
      console.log("crypto-analysis list error", error);
      throw error;
    }
  }

  async distinctTimeframes(userId: number) {
    try {
      const data = await dz
        .selectDistinct({ timeframe: cryptoAnalysisTable.timeframe })
        .from(cryptoAnalysisTable)
        .where(
          and(
            // eq(cryptoAnalysisTable.create_by_user_id, userId),
            isNull(cryptoAnalysisTable.deleted_at),
          ),
        );
      return data.map((d) => d.timeframe);
    } catch (error) {
      console.log("crypto-analysis distinctTimeframes error", error);
      throw error;
    }
  }

  async distinctCoins(userId: number) {
    try {
      const data = await dz
        .selectDistinct({ coin: cryptoAnalysisTable.coin })
        .from(cryptoAnalysisTable)
        .where(
          and(
            // eq(cryptoAnalysisTable.create_by_user_id, userId),
            isNull(cryptoAnalysisTable.deleted_at),
          ),
        );
      return data.map((d) => d.coin);
    } catch (error) {
      console.log("crypto-analysis distinctCoins error", error);
      throw error;
    }
  }

  async softDelete(id: number, userId: number) {
    try {
      const data = await dz
        .update(cryptoAnalysisTable)
        .set({ deleted_at: sql`CURRENT_DATE` })
        .where(
          and(
            eq(cryptoAnalysisTable.id, id),
            eq(cryptoAnalysisTable.create_by_user_id, userId),
          ),
        )
        .returning();
      return data[0];
    } catch (error) {
      console.log("crypto-analysis softDelete error", error);
      throw error;
    }
  }
}
