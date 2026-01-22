import { Elysia, t } from "elysia";
import { ocrClient, type ImageRequest, type BatchImageRequest, type MultiImageRequest, type OCRResult, type BatchOCRResult } from "./grpc-client";
// import * as grpc from "@grpc/grpc-js";

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
            }
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
                        filename: file.name
                    });
                }

                return new Promise((resolve, reject) => {
                    const request: BatchImageRequest = {
                        requests: batchRequests
                    };

                    ocrClient.ProcessBatch(request, (error: any, response: BatchOCRResult) => {
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
                    images: t.Files()
                })
            }
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
                        type_of_expense: type_of_expense
                    };

                    ocrClient.ProcessImages(request, (error: any, response: BatchOCRResult) => {
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
                    images: t.Files(),
                    username: t.String(),
                    type_of_expense: t.String()
                })
            }
        )
);
