import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { investmentHoldingsTable } from "../../db/investment-holdings.schema";
import dz from "../../drizzle.service";

type InvestmentInsert = typeof investmentHoldingsTable.$inferInsert;
type InvestmentUpdate = Partial<Omit<InvestmentInsert, "create_by_user_id">>;

export default class InvestmentService {
  async list(userId: number) {
    return dz
      .select()
      .from(investmentHoldingsTable)
      .where(
        and(
          eq(investmentHoldingsTable.create_by_user_id, userId),
          isNull(investmentHoldingsTable.deleted_at),
        ),
      )
      .orderBy(desc(investmentHoldingsTable.id));
  }

  async create(row: InvestmentInsert) {
    const [data] = await dz
      .insert(investmentHoldingsTable)
      .values(row)
      .returning();
    return data;
  }

  async update(id: number, userId: number, row: InvestmentUpdate) {
    const [data] = await dz
      .update(investmentHoldingsTable)
      .set(row)
      .where(
        and(
          eq(investmentHoldingsTable.id, id),
          eq(investmentHoldingsTable.create_by_user_id, userId),
          isNull(investmentHoldingsTable.deleted_at),
        ),
      )
      .returning();
    return data;
  }

  async remove(id: number, userId: number) {
    const [data] = await dz
      .update(investmentHoldingsTable)
      .set({ deleted_at: sql`CURRENT_DATE` })
      .where(
        and(
          eq(investmentHoldingsTable.id, id),
          eq(investmentHoldingsTable.create_by_user_id, userId),
          isNull(investmentHoldingsTable.deleted_at),
        ),
      )
      .returning();
    return data;
  }
}
