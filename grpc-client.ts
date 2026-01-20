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

export const ocrClient = new ocrPackage.OCRService(
  GRPC_SERVER_URL,
  grpc.credentials.createInsecure(),
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
