import { integer, numeric, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { helper } from "./helper.schema";

export const bankTransactionsTable = pgTable("bank_transactions", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  datetime: timestamp().notNull(),
  transaction_type: varchar({ length: 100 }).notNull(),
  withdrawal: numeric({ precision: 15, scale: 2 }),
  deposit: numeric({ precision: 15, scale: 2 }),
  balance: numeric({ precision: 15, scale: 2 }).notNull(),
  channel: varchar({ length: 50 }).notNull(),
  details: text(),
  ...helper,
});