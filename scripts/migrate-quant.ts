import pool from "../pg-connector";

try {
  const migration = await Bun.file(new URL("../migrations/quant/001_quant_persistence.sql", import.meta.url)).text();
  await pool.begin(async (transaction) => {
    await transaction`SET LOCAL search_path = public`;
    await transaction`SET LOCAL lock_timeout = '5s'`;
    await transaction`SET LOCAL statement_timeout = '20s'`;
    await transaction`SELECT pg_advisory_xact_lock(81427011)`;
    for (const statement of migration.split(";").map((part) => part.trim()).filter(Boolean)) {
      await transaction.unsafe(statement);
    }
  });
  const tables = await pool`SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('quant_market_snapshots', 'quant_daily_prices', 'quant_backtest_runs') ORDER BY table_name`;
  if (tables.length !== 3) throw new Error("Quant tables were not created in the expected schema");
  console.log("Quant migration complete: " + tables.map((row: { table_name: string }) => row.table_name).join(", "));
} catch {
  console.error("Quant migration failed. Check PostgreSQL connectivity and the existing backend database configuration. No credentials were logged.");
  process.exitCode = 1;
} finally { await pool.close(); }
