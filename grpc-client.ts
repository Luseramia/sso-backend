import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "path";

const PROTO_PATH = path.join(import.meta.dir, "ocr.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const ocrPackage = protoDescriptor.ocr as any;

const GRPC_SERVER_URL = process.env.OCR_GRPC_URL || '192.168.1.109:50051';
// const GRPC_SERVER_URL = process.env.OCR_GRPC_URL || "0.0.0.0:5000";

const channelOptions: grpc.ChannelOptions = {
  // Send keepalive ping every 30 seconds to keep connection alive
  'grpc.keepalive_time_ms': 30000,
  // Wait 10 seconds for keepalive ping ack before considering connection dead
  'grpc.keepalive_timeout_ms': 10000,
  // Allow keepalive pings even when there are no active RPCs
  'grpc.keepalive_permit_without_calls': 1,
  // Allow unlimited keepalive pings without data
  'grpc.http2.max_pings_without_data': 0,
  // Enable automatic retries
  'grpc.enable_retries': 1,
  // Reconnect backoff settings
  'grpc.initial_reconnect_backoff_ms': 1000,
  'grpc.max_reconnect_backoff_ms': 10000,
};

export const ocrClient = new ocrPackage.OCRService(
  GRPC_SERVER_URL,
  grpc.credentials.createInsecure(),
  channelOptions,
);

export interface ImageRequest {
  image_data: Buffer;
  filename: string;
  username?: string;
  type_of_expense?: string;
}

export interface BatchImageRequest {
  requests: ImageRequest[];
}

export interface MultiImageRequest {
  image_data: Buffer[];
  username: string;
  type_of_expense: string;
}

export interface OCRResult {
  amount: string;
  date: string;
  ref: string;
  raw_text: string;
  error: string;
  webhook_result: string;
}

export interface BatchOCRResult {
  results: OCRResult[];
}

export interface PDFStatementRequest {
  pdf_data: Buffer;
  username?: string;
}

export interface StatementTransaction {
  datetime: string;
  transaction_type: string;
  withdrawal: string;
  deposit: string;
  balance: string;
  channel: string;
  details: string;
}

export interface StatementResult {
  account_name: string;
  account_number: string;
  branch: string;
  period_start: string;
  period_end: string;
  transactions: StatementTransaction[];
  withdrawal_total: string;
  deposit_total: string;
  error: string;
}
