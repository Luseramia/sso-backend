import { describe, expect, test } from "bun:test";
import QuantService, { QuantError } from "./quant.service";
import type { QuantRepository, Snapshot, SnapshotSummary, StoredRun } from "./quant.service";
import type { PriceSeries } from "./core/twelve-data.js";
import { DEFAULT_QUANT_SETTINGS, analyzePair } from "./core/quant-analysis.js";
import { createQuantController } from "../../quant-analysis";

class MemoryRepository implements QuantRepository {
  snapshots: { owner: number; fingerprint: string; data: Snapshot }[] = [];
  runs: { owner: number; data: StoredRun }[] = [];
  async findCached(owner: number, symbol: string, count: number) {
    return this.snapshots.filter((row) => row.owner === owner && row.data.symbol === symbol && row.data.requestedCount >= count)
      .sort((a, b) => b.data.fetchedAt.localeCompare(a.data.fetchedAt))[0]?.data ?? null;
  }
  async listSnapshots(owner: number): Promise<SnapshotSummary[]> {
    const latest = new Map<string, SnapshotSummary>();
    for (const { data } of this.snapshots.filter((row) => row.owner === owner)
      .sort((a, b) => b.data.fetchedAt.localeCompare(a.data.fetchedAt))) {
      if (!latest.has(data.symbol)) latest.set(data.symbol, {
        snapshotId: data.snapshotId, symbol: data.symbol, exchange: data.exchange, currency: data.currency,
        requestedCount: data.requestedCount, rowCount: data.bars.length, cutoff: data.cutoff, fetchedAt: data.fetchedAt,
      });
    }
    return [...latest.values()];
  }
  async getSnapshot(owner: number, id: string) { return this.snapshots.find((row) => row.owner === owner && row.data.snapshotId === id)?.data ?? null; }
  async storeSnapshot(owner: number, series: PriceSeries, count: number, cutoff: string, fingerprint: string, checked: Date) {
    const existing = this.snapshots.find((row) => row.owner === owner && row.fingerprint === fingerprint);
    if (existing) { existing.data.checkedAt = checked.toISOString(); return existing.data; }
    const data = { ...structuredClone(series), snapshotId: crypto.randomUUID(), requestedCount: count, cutoff, checkedAt: checked.toISOString() };
    this.snapshots.push({ owner, fingerprint, data }); return data;
  }
  async saveRun(owner: number, run: StoredRun) { this.runs.push({ owner, data: structuredClone(run) }); }
  async listRuns(owner: number, limit: number) { return this.runs.filter((row) => row.owner === owner).slice(-limit).map((row) => row.data); }
  async getRun(owner: number, id: string) { return this.runs.find((row) => row.owner === owner && row.data.id === id)?.data ?? null; }
}

function fixture() {
  const repository = new MemoryRepository();
  let calls = 0;
  let revision = 0;
  const now = new Date("2026-10-11T10:00:00Z");
  const provider = async (symbol: string): Promise<PriceSeries> => {
    calls += 1;
    return { symbol, currency: "USD", exchange: "NASDAQ", fetchedAt: now.toISOString(), bars: Array.from({ length: 252 }, (_, i) => {
      const b = 90 + i * .2 + Math.sin(i / 8);
      const value = symbol === "AAA" ? 10 + 1.5 * b + Math.sin(i * 1.5) + revision : b;
      return { date: new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10), open: value - .2, close: value };
    }) };
  };
  const service = new QuantService(repository, provider, () => now, () => "");
  return { repository, service, calls: () => calls, revise: () => { revision += 7; }, advance: () => now.setTime(now.getTime() + 48 * 3600_000) };
}

describe("quant persistence", () => {
  test("cache hit needs no key or provider call; refresh fetches and deduplicates unchanged data", async () => {
    const f = fixture();
    const first = await f.service.prices(1, { symbol: "AAA", count: 252, apiKey: "test-key" });
    const cached = await f.service.prices(1, { symbol: "AAA", count: 252 });
    expect(cached.source).toBe("cache"); expect(cached.snapshotId).toBe(first.snapshotId); expect(f.calls()).toBe(1);
    const refreshed = await f.service.prices(1, { symbol: "AAA", count: 252, refresh: true, apiKey: "test-key" });
    expect(refreshed.source).toBe("provider"); expect(refreshed.snapshotId).toBe(first.snapshotId);
    expect(f.calls()).toBe(2); expect(f.repository.snapshots.length).toBe(1);
    expect(JSON.stringify(f.repository.snapshots)).not.toContain("test-key");
  });

  test("stored prices remain reusable on later days; another user cannot read them", async () => {
    const f = fixture();
    const first = await f.service.prices(1, { symbol: "AAA", count: 252, apiKey: "test-key" });
    expect(await f.repository.getSnapshot(2, first.snapshotId)).toBeNull();
    await expect(f.service.prices(2, { symbol: "AAA", count: 252 })).rejects.toBeInstanceOf(QuantError);
    f.advance();
    const cached = await f.service.prices(1, { symbol: "AAA", count: 100 });
    expect(cached.source).toBe("cache");
    expect(cached.snapshotId).toBe(first.snapshotId);
    expect(f.calls()).toBe(1);
    expect((await f.service.listPrices(1)).map((item) => item.symbol)).toEqual(["AAA"]);
    expect(await f.service.listPrices(2)).toEqual([]);
    expect((await f.service.storedPrices(1, first.snapshotId)).source).toBe("saved");
    await expect(f.service.storedPrices(2, first.snapshotId)).rejects.toBeInstanceOf(QuantError);
  });

  test("server saves computed results and original snapshots survive a provider revision", async () => {
    const f = fixture();
    const a = await f.service.prices(1, { symbol: "AAA", count: 252, apiKey: "test-key" });
    const b = await f.service.prices(1, { symbol: "BBB", count: 252, apiKey: "test-key" });
    const settings = { ...DEFAULT_QUANT_SETTINGS, requireCointegration: false };
    const run = await f.service.save(1, { snapshotA: a.snapshotId, snapshotB: b.snapshotId, settings, name: "Original" });
    expect(run.result).toEqual(analyzePair(a, b, settings));
    settings.entryZ = 3;
    f.revise();
    const revised = await f.service.prices(1, { symbol: "AAA", count: 252, refresh: true, apiKey: "test-key" });
    expect(revised.snapshotId).not.toBe(a.snapshotId);
    const reopened = await f.service.get(1, run.id);
    expect(reopened.a.bars).toEqual(a.bars);
    expect(reopened.settings.entryZ).toBe(2);
    expect(reopened.result).toEqual(run.result);
    expect(f.calls()).toBe(3);
    expect(await f.service.list(2)).toEqual([]);
    await expect(f.service.get(2, run.id)).rejects.toBeInstanceOf(QuantError);
    await expect(f.service.save(2, { snapshotA: a.snapshotId, snapshotB: b.snapshotId, settings })).rejects.toBeInstanceOf(QuantError);
  });

  test("validation failures do not create an analysis record", async () => {
    const f = fixture();
    const a = await f.service.prices(1, { symbol: "AAA", count: 252, apiKey: "test-key" });
    await expect(f.service.save(1, { snapshotA: a.snapshotId, snapshotB: a.snapshotId, settings: DEFAULT_QUANT_SETTINGS })).rejects.toBeInstanceOf(QuantError);
    expect(f.repository.runs.length).toBe(0);
    await expect(f.service.prices(1, { symbol: "AAA", count: 10, apiKey: "test-key" })).rejects.toBeInstanceOf(QuantError);
  });

  test("HTTP routes validate input under the application's parent signature guard", async () => {
    const f = fixture();
    const app = createQuantController(f.service);
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${Buffer.from(JSON.stringify({ id: 1 })).toString("base64")}.unit-test` };
    const unauthorized = await app.handle(new Request("http://localhost/quant/runs"));
    expect(unauthorized.status).toBe(401);
    const invalid = await app.handle(new Request("http://localhost/quant/market-data", { method: "POST", headers, body: JSON.stringify({ symbol: "AAA", count: 1 }) }));
    expect(invalid.status).toBe(400);
    const response = await app.handle(new Request("http://localhost/quant/market-data", { method: "POST", headers, body: JSON.stringify({ symbol: "AAA", count: 252, apiKey: "test-key" }) }));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.data.snapshotId).toBeDefined();
    expect(result.data.source).toBe("provider");
    const prices = await app.handle(new Request("http://localhost/quant/market-data", { headers }));
    expect((await prices.json()).data[0].symbol).toBe("AAA");
    const stored = await app.handle(new Request(`http://localhost/quant/market-data/${result.data.snapshotId}`, { headers }));
    expect((await stored.json()).data.source).toBe("saved");
    expect(f.calls()).toBe(1);
    const list = await app.handle(new Request("http://localhost/quant/runs", { headers }));
    expect(await list.json()).toEqual({ data: [] });
  });
});
