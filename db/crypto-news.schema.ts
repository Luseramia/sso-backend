import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { helper } from "./helper.schema";

export const cryptoNewsTable = pgTable("crypto_news", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),

  title: varchar({ length: 500 }).notNull(),
  link: text().notNull(),
  source: varchar({ length: 200 }),
  pub_date: timestamp(),

  summary_th: text(),

  sentiment: varchar({ length: 20 }),
  sentiment_reason: text(),

  coins_mentioned: jsonb().$type<string[]>().default([]),

  pre_score: integer(),
  source_attribution_score: integer(),
  source_attribution_notes: text(),

  red_flags: jsonb().$type<string[]>().default([]),
  credibility: varchar({ length: 20 }),
  recommended_action: text(),

  parse_ok: boolean().default(true),

  analyzed_at: timestamp().notNull(),

  ...helper,
});
