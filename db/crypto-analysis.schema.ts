import {
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { helper } from "./helper.schema";

export const cryptoAnalysisTable = pgTable("crypto_analysis", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),

  analyzed_at: timestamp().notNull(),
  coin: varchar({ length: 30 }).notNull(),
  timeframe: varchar({ length: 10 }).notNull(),

  trend: varchar({ length: 20 }),
  trend_reason: text(),

  recommendation: varchar({ length: 20 }),
  recommendation_reason: text(),
  entry_price: numeric({ precision: 20, scale: 8 }),
  stop_loss: numeric({ precision: 20, scale: 8 }),
  stop_loss_note: text(),
  target_1: numeric({ precision: 20, scale: 8 }),
  target_2: numeric({ precision: 20, scale: 8 }),

  resistance_1: numeric({ precision: 20, scale: 8 }),
  resistance_1_note: text(),
  resistance_2: numeric({ precision: 20, scale: 8 }),
  resistance_2_note: text(),
  support_1: numeric({ precision: 20, scale: 8 }),
  support_1_note: text(),
  support_2: numeric({ precision: 20, scale: 8 }),
  support_2_note: text(),

  rsi: numeric({ precision: 10, scale: 2 }),
  atr: numeric({ precision: 20, scale: 8 }),

  ema_note: text(),
  macd_note: text(),
  bollinger_note: text(),
  volume_note: text(),
  risk_note: text(),

  raw_text: text().notNull(),

  create_by_user_id: integer(),
  ...helper,
});
