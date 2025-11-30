import Redis from "ioredis";

export const redis = new Redis({
    host: "192.168.1.107",
    port: 6379,
    db: 0,
});
