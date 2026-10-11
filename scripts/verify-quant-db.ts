// Verify on PostgreSQL inside one transaction; all fixture data and DDL are rolled back.
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import dz from "../drizzle.service";
import pool from "../pg-connector";
import QuantService from "../services/quant/quant.service";
import PostgresQuantRepository from "../services/quant/quant.repository";
import { DEFAULT_QUANT_SETTINGS } from "../services/quant/core/quant-analysis.js";
import { quantPrices } from "../db/quant-analysis.schema";

const rollback = new Error("Successful verification; rollback fixtures");
try {
  await dz.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL search_path = public`);
    await tx.execute(sql`SET LOCAL lock_timeout = '5s'`);
    await tx.execute(sql`SET LOCAL statement_timeout = '20s'`);
    const migration = await Bun.file(new URL("../migrations/quant/001_quant_persistence.sql", import.meta.url)).text();
    for (const statement of migration.split(";").map((part) => part.trim()).filter(Boolean)) await tx.execute(sql.raw(statement));
    const repository = new PostgresQuantRepository(tx);
    let calls = 0;
    const service = new QuantService(repository, async (symbol) => {
      calls++;
      return { symbol, currency: "USD", exchange: "TEST", fetchedAt: new Date().toISOString(), bars: Array.from({ length: 150 }, (_, i) => ({
        date: new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10),
        open: 100 + i / 10, close: 100 + i / 10 + (symbol === "QATEST" ? Math.sin(i) : Math.sin(i / 3)),
      })) };
    });
    const owner = 2147483646;
    const a = await service.prices(owner, { symbol: "QATEST", count: 252, apiKey: "fixture-key" });
    const b = await service.prices(owner, { symbol: "QBTEST", count: 252, apiKey: "fixture-key" });
    const hit = await service.prices(owner, { symbol: "QATEST", count: 252 });
    assert.equal(hit.snapshotId, a.snapshotId); assert.equal(calls, 2);
    const shorter = await service.prices(owner, { symbol: "QATEST", count: 100 });
    assert.equal(shorter.snapshotId, a.snapshotId); assert.equal(calls, 2);
    assert.deepEqual((await service.listPrices(owner)).map((item) => item.symbol), ["QATEST", "QBTEST"]);
    assert.deepEqual(await service.listPrices(owner - 1), []);
    assert.equal((await service.storedPrices(owner, a.snapshotId)).snapshotId, a.snapshotId);
    await assert.rejects(service.storedPrices(owner - 1, a.snapshotId));
    const repeated = await service.prices(owner, { symbol: "QATEST", count: 252, refresh: true, apiKey: "fixture-key" });
    assert.equal(repeated.snapshotId, a.snapshotId);
    assert.equal(repeated.bars.length, 150);
    const saved = await service.save(owner, { snapshotA: a.snapshotId, snapshotB: b.snapshotId, settings: DEFAULT_QUANT_SETTINGS, name: "Rollback-only verification" });
    const reopened = await new QuantService(new PostgresQuantRepository(tx)).get(owner, saved.id);
    assert.deepEqual(reopened.result, saved.result);
    assert.deepEqual(reopened.a.bars, saved.a.bars);
    assert.deepEqual(reopened.settings, saved.settings);
    assert.equal((await service.list(owner)).some((run) => run.id === saved.id), true);
    await assert.rejects(service.get(owner - 1, saved.id));
    // Owner isolation is also enforced by the database's composite foreign keys.
    await assert.rejects(tx.transaction(async (nested) => {
      await new PostgresQuantRepository(nested).saveRun(owner - 1, { ...saved, id: crypto.randomUUID() });
    }));
    await assert.rejects(tx.transaction(async (nested) => {
      await nested.insert(quantPrices).values({ snapshot_id: a.snapshotId, date: "2020-01-01", open: "-1", close: "100" });
    }));
    console.log("PostgreSQL verification passed: snapshot + price persistence, cache reuse, deduplication, saved reports, owner isolation, and positive-price constraints.");
    throw rollback;
  });
} catch (error) {
  if (error === rollback) console.log("Verification transaction rolled back; no fixture records retained.");
  else {
    // Class and code only: database error messages may contain connection details or row contents.
    console.error("PostgreSQL verification failed:", error instanceof Error ? error.name : "UnknownError",
      typeof error === "object" && error && "code" in error ? String(error.code) : "");
    process.exitCode = 1;
  }
} finally { await pool.close(); }
