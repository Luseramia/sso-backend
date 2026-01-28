import { Elysia, t } from "elysia";
import { redis } from "./redis";
// import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
const productionApi =
  process.env.N8N_PRODUCTION_API ||
  "http://192.168.1.53:5678/webhook/02bb3007-efbd-414c-8e6c-2cf2718ce984";
export const chatController = new Elysia().group("/chat", (app) =>
  app
    .post(
      "/message",
      async ({ body, set }) => {
        const { message, file } = body;

        if (!message && !file) {
          set.status = 400;
          return { error: "Message or file is required" };
        }

        const timestamp = new Date().toISOString();
        const results = [];

        // Handle text message
        if (message) {
          const messageData = {
            type: "text",
            content: message,
            timestamp,
          };
          const result = await onSaveMessage(message);

          if (result.message === "Workflow was started") {
            return {
              success: true,
              data: { type: "message", status: "stored" },
            };
          } else {
            return {
              success: true,
              data: { type: "message", status: "error at n8n" },
            };
          }
        }

        // Handle file upload
        if (file) {
          // We store the file on disk and the path in the database.
          // Storing large files directly in the database (especially Redis) is not recommended
          // as it consumes a lot of memory and can slow down the database.
          const fileName = `${Date.now()}-${file.name}`;
          const formData = new FormData();
          formData.append("file", file, fileName);
          formData.append("filename", file.name);
          formData.append("mimetype", file.type);
          formData.append("type", 'file');
          formData.append("size", file.size.toString());

          const response = await fetch(productionApi, {
            method: "POST",
            body: formData,
          });
          if (!response.ok) {
            console.log("masfkmasdf", response);

            return { success: false };
          }

          return {
            success: true,
            data: { type: "file", status: "stored", },
          };
        }
      },
      {
        body: t.Object({
          message: t.Optional(t.String()),
          file: t.Optional(t.File()),
        }),
      },
    )
);

async function onSaveMessage(message: string) {
  try {
    const res = await fetch(productionApi, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-AUTH": "MTI5OTk0OTgxOTE0MTU1NDE5Nw",
      },
      body: JSON.stringify({
        message,
        type:'text'
      }),
    });

    const text = await res.text();

    // ถ้าเป็น JSON ค่อย parse
    if (res.headers.get("content-type")?.includes("application/json")) {
      return JSON.parse(text);
    } else {
      return { error: "Not JSON", raw: text };
    }
  } catch (err: any) {
    console.error("Fetch error:", err);
    return { error: err.message };
  }
}
