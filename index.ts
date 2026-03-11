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

const app = new Elysia()
  .use(
    cors({
      origin: "*",
    }),
  )
  .onBeforeHandle(rateLimiter)
  .use(ssoController)
  // .use(chatController)
  // .use(websocketController)
  // .onBeforeHandle(async (c) => {
  //   if (!c.headers.authorization) {
  //     c.set.status = 401;
  //     return { error: "unauthorize" };
  //   }
  //   if (!(await tokenChecker(c.headers.authorization))) {
  //     c.set.status = 403;
  //     return { error: "Forbiden" };
  //   }
  // })
  .guard({
    async beforeHandle(c) {
      if (!c.headers.authorization) {
        c.set.status = 401;
        return { error: "unauthorize" };
      }
      if (!(await tokenChecker(c.headers.authorization))) {
        c.set.status = 403;
        return { error: "Forbiden" };
      }
    }
  }, (app) =>
    // ทุก Controller ในนี้จะโดนเช็ค Token อัตโนมัติ
    app.use(ocrController)
    // .use(chatController)
  )

  // .use(ocrController)

  // .use(AuthorizationController)

  .listen(3000);
