import { date, integer, numeric, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { helper } from "./helper.schema";

export const investmentHoldingsTable = pgTable("investment_holdings", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  symbol: varchar({ length: 20 }).notNull(),
  asset_name: varchar({ length: 200 }).notNull(),
  asset_type: varchar({ length: 50 }).notNull(),
  market: varchar({ length: 100 }).notNull(),
  quantity: numeric({ precision: 30, scale: 10 }).notNull(),
  total_cost: numeric({ precision: 20, scale: 2 }).notNull(),
  current_price: numeric({ precision: 20, scale: 4 }).notNull(),
  purchase_date: date().notNull(),
  notes: text(),
  create_by_user_id: integer().notNull(),
  ...helper,
});
