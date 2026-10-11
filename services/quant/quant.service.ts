import { createHash } from "node:crypto";
import { analyzePair, QUANT_ENGINE_VERSION } from "./core/quant-analysis.js";
import type { QuantSettings } from "./core/quant-analysis.js";
import { fetchDailyPrices, latestCompletedDate, normalizeSymbol } from "./core/twelve-data.js";
import type { PriceSeries } from "./core/twelve-data.js";

export interface Snapshot extends PriceSeries {
  snapshotId: string;
  requestedCount: number;
  cutoff: string;
  checkedAt: string;
}

export interface SnapshotSummary {
  snapshotId: string; symbol: string; exchange: string; currency: string;
  requestedCount: number; rowCount: number; cutoff: string; fetchedAt: string;
}

export interface RunSummary {
  id: string; name: string; symbolA: string; symbolB: string; createdAt: string;
  engineVersion: string; netReturn: number; tradeCount: number;
}

export interface StoredRun extends RunSummary {
  snapshotA: string; snapshotB: string;
  settings: QuantSettings;
  result: ReturnType<typeof analyzePair>;
}

export interface QuantRepository {
  findCached(owner: number, symbol: string, count: number): Promise<Snapshot | null>;
  listSnapshots(owner: number): Promise<SnapshotSummary[]>;
  getSnapshot(owner: number, id: string): Promise<Snapshot | null>;
  storeSnapshot(owner: number, series: PriceSeries, count: number, cutoff: string, fingerprint: string, checked: Date): Promise<Snapshot>;
  saveRun(owner: number, run: StoredRun): Promise<void>;
  listRuns(owner: number, limit: number): Promise<RunSummary[]>;
  getRun(owner: number, id: string): Promise<StoredRun | null>;
}

export class QuantError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export default class QuantService {
  constructor(
    private repository: QuantRepository,
    private provider: typeof fetchDailyPrices = fetchDailyPrices,
    private now: () => Date = () => new Date(),
    private serverKey: () => string = () => process.env.TWELVEDATA_API_KEY ?? "",
  ) {}

  async prices(owner: number, input: { symbol: string; count: number; refresh?: boolean; apiKey?: string }) {
    let symbol: string;
    try { symbol = normalizeSymbol(input.symbol); } catch (error) { throw new QuantError(400, (error as Error).message); }
    if (!Number.isInteger(input.count) || input.count < 100 || input.count > 2000) throw new QuantError(400, "จำนวนวันต้องอยู่ระหว่าง 100–2,000");
    const now = this.now();
    const cutoff = latestCompletedDate(now);
    if (!input.refresh) {
      const snapshot = await this.repository.findCached(owner, symbol, input.count);
      if (snapshot) return { ...snapshot, source: "cache" as const };
    }
    const key = input.apiKey?.trim() || this.serverKey().trim();
    if (!key) throw new QuantError(400, "ยังไม่มีราคาของหุ้นตัวนี้ในฐานข้อมูล กรุณากรอก Twelve Data API key หรือตั้ง TWELVEDATA_API_KEY ที่ backend");
    let series: PriceSeries;
    try { series = await this.provider(symbol, key, input.count); }
    catch (error) {
      // Provider error messages are controlled by our adapter; never log the key or request URL.
      throw new QuantError(502, error instanceof Error ? error.message : "ดึงข้อมูลราคาจาก Twelve Data ไม่สำเร็จ");
    }
    const fingerprint = createHash("sha256").update(JSON.stringify({
      provider: "twelvedata", symbol, exchange: series.exchange, currency: series.currency,
      interval: "1day", adjustment: "all", count: input.count, cutoff, bars: series.bars,
    })).digest("hex");
    const saved = await this.repository.storeSnapshot(owner, series, input.count, cutoff, fingerprint, now);
    return { ...saved, source: "provider" as const };
  }

  listPrices(owner: number) { return this.repository.listSnapshots(owner); }

  async storedPrices(owner: number, id: string) {
    const snapshot = await this.repository.getSnapshot(owner, id);
    if (!snapshot) throw new QuantError(404, "ไม่พบชุดราคาของผู้ใช้นี้");
    return { ...snapshot, source: "saved" as const };
  }

  async save(owner: number, input: { snapshotA: string; snapshotB: string; settings: QuantSettings; name?: string }) {
    const [a, b] = await Promise.all([this.repository.getSnapshot(owner, input.snapshotA), this.repository.getSnapshot(owner, input.snapshotB)]);
    if (!a || !b) throw new QuantError(404, "ไม่พบชุดราคาของผู้ใช้นี้ กรุณาโหลดข้อมูลใหม่");
    let result: ReturnType<typeof analyzePair>;
    try { result = analyzePair(a, b, input.settings); }
    catch (error) { throw new QuantError(400, error instanceof Error ? error.message : "พารามิเตอร์ไม่ถูกต้อง"); }
    const run: StoredRun = {
      id: crypto.randomUUID(), name: input.name?.trim().slice(0, 120) || `${a.symbol} / ${b.symbol}`,
      snapshotA: a.snapshotId, snapshotB: b.snapshotId, symbolA: a.symbol, symbolB: b.symbol,
      createdAt: this.now().toISOString(), engineVersion: QUANT_ENGINE_VERSION,
      settings: { ...input.settings }, result,
      netReturn: result.backtest.netReturn, tradeCount: result.backtest.trades.length,
    };
    await this.repository.saveRun(owner, run);
    return { ...run, a: { ...a, source: "saved" as const }, b: { ...b, source: "saved" as const } };
  }

  list(owner: number) { return this.repository.listRuns(owner, 50); }

  async get(owner: number, id: string) {
    const run = await this.repository.getRun(owner, id);
    if (!run) throw new QuantError(404, "ไม่พบผลวิเคราะห์ของผู้ใช้นี้");
    const [a, b] = await Promise.all([this.repository.getSnapshot(owner, run.snapshotA), this.repository.getSnapshot(owner, run.snapshotB)]);
    if (!a || !b) throw new QuantError(409, "ชุดราคาอ้างอิงไม่ครบ กรุณาตรวจสอบฐานข้อมูล");
    return { ...run, a: { ...a, source: "saved" as const }, b: { ...b, source: "saved" as const } };
  }
}
