import { serve } from "bun";
import Elysia from "elysia";
import { redis } from "./redis";
import { ssoController } from "./login";
import { ocrController } from "./ocr";
import { chatController } from "./chat";
import { tokenChecker } from "./authorize";
import { cors } from "@elysiajs/cors";
import { websocketController } from "./websocket";

const app = new Elysia()
.use(ssoController)
.use(chatController)
.use(websocketController)
  .onBeforeHandle(async (c) => {
    if (!c.headers.authorization) {
      c.set.status = 401;
      return { error: "unauthorize" };
    }
    if (!(await tokenChecker(c.headers.authorization))) {
      c.set.status = 403;
      return { error: "Forbiden" };
    }
  })
  .use(ocrController)
  // .use(AuthorizationController)
  .use(
    cors({
      origin: "*",
      // origin: "http://localhost:5173",
    })
  )
  .listen(3000);
