import { redis } from "../../redis";

export type FinancialAiPreviewJobStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

interface RedisJobClient {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<unknown>;
}

interface StoredFinancialAiPreviewJob {
  jobId: string;
  userId: number;
  status: FinancialAiPreviewJobStatus;
  result?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialAiPreviewJob {
  jobId: string;
  status: FinancialAiPreviewJobStatus;
  result?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

const JOB_TTL_SECONDS = 2 * 60 * 60;

export default class FinancialAiPreviewJobStore {
  constructor(
    private readonly client: RedisJobClient = redis,
    private readonly ttlSeconds = JOB_TTL_SECONDS,
  ) {}

  async create(userId: number): Promise<FinancialAiPreviewJob> {
    const now = new Date().toISOString();
    const job: StoredFinancialAiPreviewJob = {
      jobId: crypto.randomUUID(),
      userId,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    };
    await this.save(job);
    return this.publicJob(job);
  }

  async markProcessing(jobId: string): Promise<void> {
    await this.update(jobId, (job) => ({ ...job, status: "PROCESSING" }));
  }

  async complete(jobId: string, result: unknown): Promise<void> {
    await this.update(jobId, (job) => ({
      ...job,
      status: "COMPLETED",
      result,
      error: undefined,
    }));
  }

  async fail(jobId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    await this.update(jobId, (job) => ({
      ...job,
      status: "FAILED",
      result: undefined,
      error: (message || "AI preview failed").slice(0, 1000),
    }));
  }

  async get(userId: number, jobId: string): Promise<FinancialAiPreviewJob> {
    const job = await this.read(jobId);
    if (!job || job.userId !== userId) throw new Error("AI preview job not found");
    return this.publicJob(job);
  }

  private key(jobId: string) {
    return `financial-analysis:ai-preview:${jobId}`;
  }

  private async read(jobId: string): Promise<StoredFinancialAiPreviewJob | null> {
    const value = await this.client.get(this.key(jobId));
    if (!value) return null;
    return JSON.parse(value) as StoredFinancialAiPreviewJob;
  }

  private async save(job: StoredFinancialAiPreviewJob): Promise<void> {
    await this.client.setex(this.key(job.jobId), this.ttlSeconds, JSON.stringify(job));
  }

  private async update(
    jobId: string,
    mutate: (job: StoredFinancialAiPreviewJob) => StoredFinancialAiPreviewJob,
  ): Promise<void> {
    const current = await this.read(jobId);
    if (!current) throw new Error("AI preview job expired");
    await this.save({ ...mutate(current), updatedAt: new Date().toISOString() });
  }

  private publicJob(job: StoredFinancialAiPreviewJob): FinancialAiPreviewJob {
    const { userId: _userId, ...safeJob } = job;
    return safeJob;
  }
}
