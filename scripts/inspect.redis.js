
require("dotenv").config();

const {
    redisClient,
    connectRedis
} = require("../src/config/redis");

const getKeys = async (pattern) => {
    const keys = [];

    for await (const result of redisClient.scanIterator({
        MATCH: pattern,
        COUNT: 100
    })) {
        // Some Redis client versions return batches.
        if (Array.isArray(result)) {
            keys.push(...result);
        } else if (typeof result === "string") {
            keys.push(result);
        } else if (result && Array.isArray(result.keys)) {
            keys.push(...result.keys);
        } else {
            console.log("Unexpected SCAN result:", result);
        }
    }

    return keys;
};

const inspectRedis = async () => {
    try {
        await connectRedis();

        if (!redisClient.isReady) {
            throw new Error("Redis is not ready");
        }

        // 1. Cell counters
        const countsKey = "geopulse:{live}:cell:counts";
        const cellCounts = await redisClient.hGetAll(countsKey);

        console.log("\n========== CELL COUNTS ==========");
        console.log(cellCounts);

        // 2. Driver records
        const driverKeys = await getKeys(
            "geopulse:{live}:driver:*"
        );

        console.log("\n========== DRIVER RECORDS ==========");
        console.log("Total driver records:", driverKeys.length);

        for (const key of driverKeys.slice(0, 10)) {
            const state = await redisClient.hGetAll(key);

            console.log("\nKey:", key);
            console.log("State:", state);
        }

        // 3. Processed event records
        const processedKeys = await getKeys(
            "geopulse:{live}:processed:*"
        );

        console.log("\n========== PROCESSED EVENTS ==========");
        console.log("Processed event keys:", processedKeys.length);

        console.log("\nRedis inspection completed.");

    } catch (error) {
        console.error("\nRedis inspection failed:", error);

    } finally {
        if (redisClient.isReady) {
            await redisClient.quit();
        }
    }
};

inspectRedis();
