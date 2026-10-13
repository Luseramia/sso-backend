import pool from "../pg-connector";

try {
  const migration = await Bun.file(new URL("../migrations/investments/001_investment_currency.sql", import.meta.url)).text();
  await pool.begin(async (transaction) => {
    await transaction`SET LOCAL search_path = public`;
    await transaction`SET LOCAL lock_timeout = '5s'`;
    await transaction`SET LOCAL statement_timeout = '20s'`;
    await transaction`SELECT pg_advisory_xact_lock(81427012)`;
    for (const statement of migration.split(";").map((part) => part.trim()).filter(Boolean)) {
      await transaction.unsafe(statement);
    }
  });

  const columns = await pool`SELECT column_default, is_nullable FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'investment_holdings' AND column_name = 'currency'`;
  const column = columns[0];
  if (!column || column.is_nullable !== "NO" || !String(column.column_default ?? "").includes("THB")) {
    throw new Error("Investment currency column was not created as expected");
  }
  const constraints = await pool`SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.investment_holdings'::regclass AND conname = 'investment_holdings_currency_check'`;
  if (constraints.length !== 1) throw new Error("Investment currency constraint was not created as expected");
  console.log("Investment migration complete: currency defaults existing and new holdings to THB; USD is supported.");
} catch {
  console.error("Investment migration failed. Check PostgreSQL connectivity and the existing backend database configuration. No credentials were logged.");
  process.exitCode = 1;
} finally {
  await pool.close();
}
