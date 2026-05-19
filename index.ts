import { serve } from "bun";
import Elysia from "elysia";
import { redis } from "./redis";
import { ssoController } from "./login";
import { ocrController } from "./ocr";
import { chatController } from "./chat";
import { tokenChecker } from "./authorize";
import { cors } from "@elysiajs/cors";
import { websocketController } from "./websocket";
import { rateLimiter } from "./rate-limit";
import pool from "./pg-connector";
import { fileManagerController } from "./file-manager";
import { cryptoAnalysisController } from "./crypto-analysis";

// pool
const app = new Elysia()
  // .use(
  //   cors({
  //     origin: "*",
  //     methods: ["GET", "POST", "OPTIONS"],
  //     allowedHeaders: ["*"],
  //   }),
  // )
  .use(
    cors({
      origin: "*",
    }),
  )
  .onBeforeHandle(rateLimiter)
  .use(ssoController)
  .guard(
    {
      async beforeHandle(c) {
        // 🔥 อนุญาต OPTIONS ก่อน
        if (c.request.method === "OPTIONS") return;

        if (!c.headers.authorization) {
          c.set.status = 401;
          return { error: "unauthorize" };
        }

        if (!(await tokenChecker(c.headers.authorization))) {
          c.set.status = 403;
          return { error: "Forbidden" };
        }
      },
    },
    (app) =>
      // ทุก Controller ในนี้จะโดนเช็ค Token อัตโนมัติ
      app
        .use(ocrController)
        .use(fileManagerController)
        .use(cryptoAnalysisController),
    // .use(chatController)
  )

  // .use(ocrController)

  // .use(AuthorizationController)

  .listen({
    port: 3000,
    maxRequestBodySize: 1024 * 1024 * 1024, // 1GB (1024MB)
  });
