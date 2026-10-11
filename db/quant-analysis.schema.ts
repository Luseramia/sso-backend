import { sql } from "drizzle-orm";
import { check, date, doublePrecision, foreignKey, index, integer, jsonb, numeric, pgTable, primaryKey, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import type { QuantSettings, analyzePair } from "../services/quant/core/quant-analysis.js";

export const quantSnapshots = pgTable("quant_market_snapshots", {
  id: uuid().primaryKey(),
  owner_id: integer().notNull(),
  provider: varchar({ length: 30 }).notNull().default("twelvedata"),
  symbol: varchar({ length: 15 }).notNull(),
  exchange: varchar({ length: 80 }).notNull(),
  currency: varchar({ length: 3 }).notNull().default("USD"),
  interval: varchar({ length: 10 }).notNull().default("1day"),
  adjustment: varchar({ length: 10 }).notNull().default("all"),
  requested_count: integer().notNull(),
  row_count: integer().notNull(),
  cutoff_date: date().notNull(),
  fingerprint: varchar({ length: 64 }).notNull(),
  fetched_at: timestamp({ withTimezone: true }).notNull(),
  checked_at: timestamp({ withTimezone: true }).notNull(),
}, (table) => [
  check("quant_market_snapshots_owner_id_check", sql`${table.owner_id} > 0`),
  check("quant_market_snapshots_requested_count_check", sql`${table.requested_count} BETWEEN 100 AND 2000`),
  check("quant_market_snapshots_row_count_check", sql`${table.row_count} BETWEEN 60 AND 2000`),
  unique("quant_snapshot_owner_id_uq").on(table.owner_id, table.id),
  unique("quant_snapshot_owner_fingerprint_uq").on(table.owner_id, table.fingerprint),
  index("quant_snapshot_cache_idx").on(table.owner_id, table.symbol, table.requested_count, table.cutoff_date, table.checked_at),
]);

export const quantPrices = pgTable("quant_daily_prices", {
  snapshot_id: uuid().notNull().references(() => quantSnapshots.id),
  date: date().notNull(),
  open: numeric({ precision: 30, scale: 11 }).notNull(),
  close: numeric({ precision: 30, scale: 11 }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.snapshot_id, table.date] }),
  check("quant_daily_prices_open_check", sql`${table.open} > 0`),
  check("quant_daily_prices_close_check", sql`${table.close} > 0`),
]);

export const quantRuns = pgTable("quant_backtest_runs", {
  id: uuid().primaryKey(),
  owner_id: integer().notNull(),
  name: varchar({ length: 120 }).notNull(),
  snapshot_a_id: uuid().notNull(),
  snapshot_b_id: uuid().notNull(),
  symbol_a: varchar({ length: 15 }).notNull(),
  symbol_b: varchar({ length: 15 }).notNull(),
  engine_version: varchar({ length: 30 }).notNull(),
  settings: jsonb().$type<QuantSettings>().notNull(),
  result: jsonb().$type<ReturnType<typeof analyzePair>>().notNull(),
  net_return: doublePrecision().notNull(),
  trade_count: integer().notNull(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("quant_backtest_runs_owner_id_check", sql`${table.owner_id} > 0`),
  check("quant_backtest_runs_trade_count_check", sql`${table.trade_count} >= 0`),
  index("quant_runs_owner_created_idx").on(table.owner_id, table.created_at),
  foreignKey({ name: "quant_run_a_owner_fk", columns: [table.owner_id, table.snapshot_a_id], foreignColumns: [quantSnapshots.owner_id, quantSnapshots.id] }),
  foreignKey({ name: "quant_run_b_owner_fk", columns: [table.owner_id, table.snapshot_b_id], foreignColumns: [quantSnapshots.owner_id, quantSnapshots.id] }),
]);
