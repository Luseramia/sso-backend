import { redis } from "./redis";
export async function rateLimiter(c: any): Promise<any> {
  // const ip =
  //   c.request.headers.get("x-forwarded-for") ||
  //   c.server?.requestIP?.(c.request)?.address ||
  //   "unknown";

  const ip = getClientIP(c);

  const key = `rate:global:${ip}`;
  const count = await redis.incr(key);
  console.log("count", count);

  if (count === 1) {
    await redis.expire(key, 60);
  }

  if (count > 50) {
    c.set.status = 429;
    return { error: "Too many requests" };
  }
}

const getClientIP = (c: any) => {
  const headers = c.request.headers;

  // 🔵 Cloudflare (เชื่อถือได้ถ้าคุณอยู่หลัง CF เท่านั้น)
  const cfIP = headers.get("cf-connecting-ip");
  if (cfIP) return cfIP;

  // 🟡 nginx / ingress
  const realIP = headers.get("x-real-ip");
  if (realIP) return realIP;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  // 🟢 Direct connection (dev / localhost)
  if (c.server?.requestIP) {
    const info = c.server.requestIP(c.request);
    if (info?.address) return info.address;
  }

  return "unknown";
};
