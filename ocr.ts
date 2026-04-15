import { Elysia, t } from "elysia";
import {
  ocrClient,
  type ImageRequest,
  type BatchImageRequest,
  type MultiImageRequest,
  type OCRResult,
  type BatchOCRResult,
  type PDFStatementRequest,
  type StatementResult,
} from "./grpc-client";
import * as grpc from "@grpc/grpc-js";
import BankTransactionService from "./services/bank-transaction/bank-transaction.service";

const bankTransactionService = new BankTransactionService();

// await new Promise((resolve, reject) => {
//   grpc.waitForClientReady(
//     ocrClient,
//     Date.now() + 5000,
//     (err: any) => {
//       if (err) reject(err);
//       else resolve(true);
//     }
//   );
// });

export const ocrController = new Elysia().group("/ocr", (app) =>
  app
    .post(
      "/process",
      async ({ body, set }) => {
        const { image } = body;

        if (!image) {
          set.status = 400;
          return { error: "Image file is required" };
        }

        const arrayBuffer = await image.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        return new Promise((resolve, reject) => {
          const request: ImageRequest = {
            image_data: buffer,
            filename: image.name,
          };

          ocrClient.ProcessImage(request, (error: any, response: OCRResult) => {
            if (error) {
              console.error("gRPC Error:", error);
              set.status = 500;
              resolve({ error: error.message || "Internal Server Error" });
            } else {
              resolve(response);
            }
          });
        });
      },
      {
        body: t.Object({
          image: t.File(),
        }),
      },
    )
    .post(
      "/batch",
      async ({ body, set }) => {
        const { images } = body;

        if (!images || images.length === 0) {
          set.status = 400;
          return { error: "At least one image is required" };
        }

        const imageFiles = Array.isArray(images) ? images : [images];
        const batchRequests: ImageRequest[] = [];

        for (const file of imageFiles) {
          const arrayBuffer = await file.arrayBuffer();
          batchRequests.push({
            image_data: Buffer.from(arrayBuffer),
            filename: file.name,
          });
        }

        return new Promise((resolve, reject) => {
          const request: BatchImageRequest = {
            requests: batchRequests,
          };

          ocrClient.ProcessBatch(
            request,
            (error: any, response: BatchOCRResult) => {
              if (error) {
                console.error("gRPC Error:", error);
                set.status = 500;
                resolve({ error: error.message || "Internal Server Error" });
              } else {
                resolve(response);
              }
            },
          );
        });
      },
      {
        body: t.Object({
          images: t.Files(),
        }),
      },
    )
    .post(
      "/process-images",
      async ({ body, set }) => {
        const { images, username, type_of_expense } = body;

        if (!images || images.length === 0) {
          set.status = 400;
          return { error: "At least one image is required" };
        }

        const imageFiles = Array.isArray(images) ? images : [images];
        const imageBuffers: Buffer[] = [];

        for (const file of imageFiles) {
          const arrayBuffer = await file.arrayBuffer();
          imageBuffers.push(Buffer.from(arrayBuffer));
        }

        return new Promise((resolve, reject) => {
          const request: MultiImageRequest = {
            image_data: imageBuffers,
            username: username,
            type_of_expense: type_of_expense,
          };

          ocrClient.ProcessImages(
            request,
            (error: any, response: BatchOCRResult) => {
              if (error) {
                console.error("gRPC Error:", error);
                set.status = 500;
                resolve({ error: error.message || "Internal Server Error" });
              } else {
                resolve(response);
              }
            },
          );
        });
      },
      {
        body: t.Object({
          images: t.Files(),
          username: t.String(),
          type_of_expense: t.String(),
        }),
      },
    )
    .post(
      "/process-statement",
      async ({ body, set }) => {
        const { pdf, username } = body;
        if (!pdf) {
          set.status = 400;
          return { error: "PDF file is required" };
        }

        const arrayBuffer = await pdf.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        return new Promise((resolve, reject) => {
          const request: PDFStatementRequest = {
            pdf_data: buffer,
            username: username,
          };

          ocrClient.ProcessStatement(
            request,
            (error: any, response: StatementResult) => {
              if (error) {
                console.error("gRPC Error:", error);
                set.status = 500;
                resolve({ error: error.message || "Internal Server Error" });
              } else {
                resolve(response);
              }
            },
          );
        });
      },
      {
        body: t.Object({
          pdf: t.File(),
          username: t.Optional(t.String()),
        }),
      },
    )
    .post(
      "/save-transactions",
      async ({ body, set, headers }) => {
        const { transactions } = body;
        const token = headers.authorization?.split(" ")[1]?.split(".")[0];

        if (!transactions || transactions.length === 0) {
          set.status = 400;
          return { error: "No transactions provided" };
        }
        if (token) {
          const userData = Buffer.from(token, "base64").toString("utf-8");
          const JsonData = JSON.parse(userData);

          try {
            const rows = transactions.map((tx) => {
              // parse "DD/MM/YYYY HH:mm:ss" → Date
              const [datePart, timePart] = tx.datetime.split(" ");
              const [day, month, year] = datePart.split("/").map(Number);
              const [hours, minutes, seconds] = (timePart || "00:00:00")
                .split(":")
                .map(Number);
              const dt = new Date(
                year,
                month - 1,
                day,
                hours,
                minutes,
                seconds,
              );

              return {
                datetime: dt,
                transaction_type: tx.transaction_type,
                withdrawal: tx.withdrawal || null,
                deposit: tx.deposit || null,
                balance: tx.balance,
                channel: tx.channel,
                details: tx.details || null,
                create_by_user_id: JsonData.id,
              };
            });

            const saved = await bankTransactionService.saveMany(rows);
            return { message: "Saved successfully", count: saved.length };
          } catch (error: any) {
            console.error("Save transactions error:", error);
            set.status = 500;
            return { error: error.message || "Failed to save transactions" };
          }
        }
      },
      {
        body: t.Object({
          transactions: t.Array(
            t.Object({
              datetime: t.String(),
              transaction_type: t.String(),
              withdrawal: t.Optional(t.String()),
              deposit: t.Optional(t.String()),
              balance: t.String(),
              channel: t.String(),
              details: t.Optional(t.String()),
            }),
          ),
        }),
      },
    )
    .get(
      "/transactions",
      async ({ query, set, headers }) => {
        const year = query.year ? Number(query.year) : new Date().getFullYear();
        const month = query.month ? Number(query.month) : undefined;
        const day = query.day ? Number(query.day) : undefined;
        const token = headers.authorization?.split(" ")[1]?.split(".")[0];
        if (token) {
          const userData = Buffer.from(token, "base64").toString("utf-8");
          const JsonData = JSON.parse(userData);
          try {
            const data = await bankTransactionService.getByDateRange({
              userId: JsonData.id,
              year,
              month,
              day,
            });
            return data;
          } catch (error: any) {
            console.error("Get transactions error:", error);
            set.status = 500;
            return { error: error.message || "Failed to fetch transactions" };
          }
        }
      },
      {
        query: t.Object({
          year: t.Optional(t.String()),
          month: t.Optional(t.String()),
          day: t.Optional(t.String()),
        }),
      },
    ),
);
