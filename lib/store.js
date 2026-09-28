// Thin key-value wrapper. Uses Upstash Redis in production — injected
// automatically once a Redis store is attached to the Vercel project
// (Storage tab -> Marketplace -> Redis). Falls back to an in-process Map
// when no Redis env vars are set, so the app runs locally (and in tests)
// without any external service.
//
// Vercel's Redis integration has used a couple of different env var names
// over time, so both are checked.

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

let impl;

if (url && token) {
  const { Redis } = require('@upstash/redis');
  const redis = new Redis({ url, token });
  impl = {
    get: (key) => redis.get(key),
    set: (key, value) => redis.set(key, value),
  };
} else {
  const memory = new Map();
  impl = {
    get: async (key) => (memory.has(key) ? memory.get(key) : null),
    set: async (key, value) => {
      memory.set(key, value);
    },
  };
}

module.exports = impl;
