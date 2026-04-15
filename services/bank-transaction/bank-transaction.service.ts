import dz from "../../drizzle.service";
import { bankTransactionsTable } from "../../db/bank-transactions.schema";
import { and, eq, gte, lt, sql } from "drizzle-orm";

type BankTransactionInsert = typeof bankTransactionsTable.$inferInsert;

export default class BankTransactionService {
  async saveMany(transactions: BankTransactionInsert[]) {
    try {
      const data = await dz
        .insert(bankTransactionsTable)
        .values(transactions)
        .returning();

      return data;
    } catch (error) {
      console.log("error", error);
      throw error;
    }
  }

  async getByDateRange(params: {
    userId: number;
    year: number;
    month?: number;
    day?: number;
  }) {
    try {
      const { year, month, day,userId } = params;

      let startDate: Date;
      let endDate: Date;

      if (day && month) {
        // specific day
        startDate = new Date(year, month - 1, day);
        endDate = new Date(year, month - 1, day + 1);
      } else if (month) {
        // whole month
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 1);
      } else {
        // whole year
        startDate = new Date(year, 0, 1);
        endDate = new Date(year + 1, 0, 1);
      }

      const data = await dz
        .select()
        .from(bankTransactionsTable)
        .where(
          and(
            gte(bankTransactionsTable.datetime, startDate),
            lt(bankTransactionsTable.datetime, endDate),
            eq(bankTransactionsTable.create_by_user_id, userId),
          ),
        )
        .orderBy(bankTransactionsTable.datetime);

      return data;
    } catch (error) {
      console.log("error", error);
      throw error;
    }
  }
}
