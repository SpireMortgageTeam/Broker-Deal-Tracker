import { Redis } from "@upstash/redis";

// Redis.fromEnv() reads KV_REST_API_URL / KV_REST_API_TOKEN (the names
// Vercel's Upstash Marketplace integration injects automatically) and
// falls back to UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN if
// you set those manually instead. Either naming works with no code change.
export const redis = Redis.fromEnv();
