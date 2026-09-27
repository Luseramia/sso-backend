import { describe, expect, test } from "bun:test";
import FinancialAiPreviewJobStore from "./financial-ai-preview-job.store";

class FakeRedis {
  values = new Map<string, string>();

  async get(key: string) {
    return this.values.get(key) ?? null;
  }

  async setex(key: string, _seconds: number, value: string) {
    this.values.set(key, value);
    return "OK";
  }
}

describe("FinancialAiPreviewJobStore", () => {
  test("tracks a completed job without exposing its owner", async () => {
    const store = new FinancialAiPreviewJobStore(new FakeRedis(), 60);
    const created = await store.create(2);

    expect(created.status).toBe("PENDING");
    expect(created).not.toHaveProperty("userId");

    await store.markProcessing(created.jobId);
    expect((await store.get(2, created.jobId)).status).toBe("PROCESSING");

    await store.complete(created.jobId, { rows: [{ originalLabel: "Assets" }] });
    const completed = await store.get(2, created.jobId);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.result).toEqual({ rows: [{ originalLabel: "Assets" }] });
  });

  test("does not expose another user's job", async () => {
    const store = new FinancialAiPreviewJobStore(new FakeRedis(), 60);
    const created = await store.create(2);
    await expect(store.get(3, created.jobId)).rejects.toThrow("AI preview job not found");
  });

  test("stores a bounded failure message", async () => {
    const store = new FinancialAiPreviewJobStore(new FakeRedis(), 60);
    const created = await store.create(2);
    await store.fail(created.jobId, new Error("x".repeat(2000)));
    const failed = await store.get(2, created.jobId);
    expect(failed.status).toBe("FAILED");
    expect(failed.error?.length).toBe(1000);
  });
});
