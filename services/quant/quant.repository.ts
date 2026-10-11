import { and, asc, desc, eq, gte } from "drizzle-orm";
import dz from "../../drizzle.service";
import { quantPrices, quantRuns, quantSnapshots } from "../../db/quant-analysis.schema";
import type { PriceSeries } from "./core/twelve-data.js";
import type { QuantRepository, Snapshot, SnapshotSummary, StoredRun } from "./quant.service";

const summaryColumns = {
  id: quantRuns.id, name: quantRuns.name, symbolA: quantRuns.symbol_a, symbolB: quantRuns.symbol_b,
  engineVersion: quantRuns.engine_version, netReturn: quantRuns.net_return,
  tradeCount: quantRuns.trade_count, createdAt: quantRuns.created_at,
};

export default class PostgresQuantRepository implements QuantRepository {
  constructor(private db: Pick<typeof dz, "select" | "insert" | "transaction"> = dz) {}

  async getSnapshot(owner: number, id: string): Promise<Snapshot | null> {
    const [snapshot] = await this.db.select().from(quantSnapshots)
      .where(and(eq(quantSnapshots.owner_id, owner), eq(quantSnapshots.id, id))).limit(1);
    if (!snapshot) return null;
    const prices = await this.db.select().from(quantPrices).where(eq(quantPrices.snapshot_id, id)).orderBy(asc(quantPrices.date));
    if (prices.length !== snapshot.row_count) throw new Error("Stored price snapshot is incomplete");
    return {
      snapshotId: id, symbol: snapshot.symbol, currency: snapshot.currency, exchange: snapshot.exchange,
      requestedCount: snapshot.requested_count, cutoff: snapshot.cutoff_date,
      fetchedAt: snapshot.fetched_at.toISOString(), checkedAt: snapshot.checked_at.toISOString(),
      bars: prices.map((row) => ({ date: row.date, open: Number(row.open), close: Number(row.close) })),
    };
  }

  async findCached(owner: number, symbol: string, count: number) {
    const [snapshot] = await this.db.select({ id: quantSnapshots.id }).from(quantSnapshots).where(and(
      eq(quantSnapshots.owner_id, owner), eq(quantSnapshots.symbol, symbol),
      eq(quantSnapshots.provider, "twelvedata"), eq(quantSnapshots.interval, "1day"), eq(quantSnapshots.adjustment, "all"),
      gte(quantSnapshots.requested_count, count),
    )).orderBy(desc(quantSnapshots.fetched_at)).limit(1);
    return snapshot ? this.getSnapshot(owner, snapshot.id) : null;
  }

  async listSnapshots(owner: number): Promise<SnapshotSummary[]> {
    const rows = await this.db.select({
      snapshotId: quantSnapshots.id, symbol: quantSnapshots.symbol, exchange: quantSnapshots.exchange,
      currency: quantSnapshots.currency, requestedCount: quantSnapshots.requested_count,
      rowCount: quantSnapshots.row_count, cutoff: quantSnapshots.cutoff_date,
      fetchedAt: quantSnapshots.fetched_at,
    }).from(quantSnapshots).where(eq(quantSnapshots.owner_id, owner))
      .orderBy(desc(quantSnapshots.fetched_at), desc(quantSnapshots.requested_count));
    const latest = new Map<string, SnapshotSummary>();
    for (const row of rows) {
      if (!latest.has(row.symbol)) latest.set(row.symbol, { ...row, fetchedAt: row.fetchedAt.toISOString() });
    }
    return [...latest.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  async storeSnapshot(owner: number, series: PriceSeries, count: number, cutoff: string, fingerprint: string, checked: Date) {
    const id = await this.db.transaction(async (tx) => {
      const [snapshot] = await tx.insert(quantSnapshots).values({
        id: crypto.randomUUID(), owner_id: owner, symbol: series.symbol, exchange: series.exchange, currency: series.currency,
        requested_count: count, row_count: series.bars.length, cutoff_date: cutoff, fingerprint,
        fetched_at: new Date(series.fetchedAt), checked_at: checked,
      }).onConflictDoUpdate({ target: [quantSnapshots.owner_id, quantSnapshots.fingerprint], set: { checked_at: checked } }).returning({ id: quantSnapshots.id });
      if (!snapshot) throw new Error("Snapshot was not saved");
      for (let i = 0; i < series.bars.length; i += 500) {
        await tx.insert(quantPrices).values(series.bars.slice(i, i + 500).map((bar) => ({
          snapshot_id: snapshot.id, date: bar.date, open: String(bar.open), close: String(bar.close),
        }))).onConflictDoNothing();
      }
      return snapshot.id;
    });
    const snapshot = await this.getSnapshot(owner, id);
    if (!snapshot) throw new Error("Snapshot could not be read after commit");
    return snapshot;
  }

  async saveRun(owner: number, run: StoredRun) {
    await this.db.insert(quantRuns).values({
      id: run.id, owner_id: owner, name: run.name, snapshot_a_id: run.snapshotA, snapshot_b_id: run.snapshotB,
      symbol_a: run.symbolA, symbol_b: run.symbolB, engine_version: run.engineVersion,
      settings: run.settings, result: run.result, net_return: run.netReturn, trade_count: run.tradeCount, created_at: new Date(run.createdAt),
    });
  }

  async listRuns(owner: number, limit: number) {
    const rows = await this.db.select(summaryColumns).from(quantRuns).where(eq(quantRuns.owner_id, owner))
      .orderBy(desc(quantRuns.created_at)).limit(limit);
    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  }

  async getRun(owner: number, id: string): Promise<StoredRun | null> {
    const [row] = await this.db.select({ ...summaryColumns, snapshotA: quantRuns.snapshot_a_id, snapshotB: quantRuns.snapshot_b_id,
      settings: quantRuns.settings, result: quantRuns.result }).from(quantRuns)
      .where(and(eq(quantRuns.id, id), eq(quantRuns.owner_id, owner))).limit(1);
    return row ? { ...row, createdAt: row.createdAt.toISOString() } : null;
  }
}
