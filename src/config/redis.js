const { createClient } = require("redis");

const redisClient = createClient({
    url: process.env.REDIS_URL,

    socket: {
        reconnectStrategy(retries) {
            return Math.min(retries * 100, 3000);
        }
    }
});

redisClient.on("error", (error) => {
    console.error("Redis error:", error.message);
});

redisClient.on("connect", () => {
    console.log("Connecting to Redis...");
});

redisClient.on("ready", () => {
    console.log("Redis connection ready");
});

const connectRedis = async () => {
    if (!process.env.REDIS_URL) {
        throw new Error("REDIS_URL is missing in .env");
    }

    if (!redisClient.isOpen) {
        await redisClient.connect();
    }

    const response = await redisClient.ping();

    if (response !== "PONG") {
        throw new Error("Redis health check failed");
    }

    console.log("Redis connected successfully:", response);
};

module.exports = {
    redisClient,
    connectRedis
};