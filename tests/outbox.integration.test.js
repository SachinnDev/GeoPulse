require("dotenv").config();

// Isolated Redis namespace for this test.
process.env.REDIS_KEY_PREFIX = "geopulse_e2e_test";

const mongoose = require("mongoose");
const request = require("supertest");

const app = require("../src/app");

const Driver = require("../src/models/Driver");
const OutboxEvent = require("../src/models/OutboxEvent");

const {
    claimNextEvent,
    processEvent
} = require("../src/workers/outbox.worker");

const {
    redisClient,
    connectRedis
} = require("../src/config/redis");

const REDIS_PREFIX = "geopulse_e2e_test:{live}";

const driverId = "e2e_driver_101";
const eventId = `${driverId}:1`;

const redisKeys = [
    `${REDIS_PREFIX}:cell:counts`,
    `${REDIS_PREFIX}:driver:${driverId}`,
    `${REDIS_PREFIX}:processed:${eventId}`
];

describe("GeoPulse End-to-End Integration Test", () => {

    const payload = {
        driverId,
        latitude: 28.6139,
        longitude: 77.2090,
        timestamp: "2026-11-04T08:00:00.000Z",
        sequenceNumber: 1,
        status: "available"
    };

    beforeAll(async () => {
        if (!process.env.TEST_MONGODB_URI) {
            throw new Error("TEST_MONGODB_URI is missing");
        }

        await mongoose.connect(process.env.TEST_MONGODB_URI);

        if (mongoose.connection.name !== "geopulse_test") {
            throw new Error(
                `Wrong test database: ${mongoose.connection.name}`
            );
        }

        await Driver.init();
        await OutboxEvent.init();

        await connectRedis();
    });

    beforeEach(async () => {
        await Driver.deleteMany({});
        await OutboxEvent.deleteMany({});

        await redisClient.del(redisKeys);
    });

    afterAll(async () => {
        await Driver.deleteMany({});
        await OutboxEvent.deleteMany({});

        await redisClient.del(redisKeys);

        if (redisClient.isOpen) {
            await redisClient.quit();
        }

        await mongoose.connection.close();
    });

    test("should process driver location from API through Outbox to Redis", async () => {

        // 1. Send actual API request.
        const response = await request(app)
            .post("/api/drivers/location")
            .send(payload);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.accepted).toBe(true);

        // 2. Verify MongoDB driver state.
        const driver = await Driver.findOne({ driverId });

        expect(driver).not.toBeNull();
        expect(driver.status).toBe("available");
        expect(driver.lastSequenceNumber).toBe(1);

        // 3. Verify Outbox event was created.
        const pendingEvent = await OutboxEvent.findOne({ eventId });

        expect(pendingEvent).not.toBeNull();
        expect(pendingEvent.status).toBe("pending");

        // 4. Claim event using actual worker function.
        const claimedEvent = await claimNextEvent();

        expect(claimedEvent).not.toBeNull();
        expect(claimedEvent.eventId).toBe(eventId);
        expect(claimedEvent.status).toBe("processing");

        // 5. Process event using actual worker function.
        await processEvent(claimedEvent);

        // 6. Verify event is marked processed.
        const processedEvent = await OutboxEvent.findOne({ eventId });

        expect(processedEvent.status).toBe("processed");
        expect(processedEvent.processedAt).not.toBeNull();

        // 7. Verify Redis cell counter.
        const h3Cell = driver.h3Cell;

        const count = await redisClient.hGet(
            `${REDIS_PREFIX}:cell:counts`,
            h3Cell
        );

        expect(Number(count)).toBe(1);

        // 8. Verify Redis driver state.
        const redisDriver = await redisClient.hGetAll(
            `${REDIS_PREFIX}:driver:${driverId}`
        );

        expect(redisDriver.cell).toBe(h3Cell);
        expect(redisDriver.status).toBe("available");
        expect(redisDriver.stateVersion).toBe("1");
    });

});