const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL);

redis.on("connect", () => {
  console.log("✓ Redis connected successfully");
});

redis.on("ready", () => {
  console.log("✓ Redis ready to use");
});

redis.on("error", (err) => {
  console.error("✗ Redis error:", err.message);
});

module.exports = redis;
