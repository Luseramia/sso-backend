import { serve } from "bun";
import Elysia from "elysia";
import { redis } from "./redis";
import { ssoController } from "./login";

import { cors } from "@elysiajs/cors";

const app = new Elysia()
  .use(ssoController)
  .use(
    cors({
      origin:'*'
      // origin: "http://localhost:5173",
    })
  )
  .listen(3000);
