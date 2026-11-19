require("dotenv").config();

// Must be set before importing redisCounter.service
process.env.REDIS_KEY_PREFIX = "geopulse_test";

const {
    redisClient,
    connectRedis
} = require("../src/config/redis");

const {
    applyDriverTransition,
    getCellCount
} = require("../src/services/redisCounter.service");

const PREFIX = "geopulse_test:{live}";

const COUNTS_KEY = `${PREFIX}:cell:counts`;

const testKeys = [
    COUNTS_KEY,
    `${PREFIX}:driver:test_driver_1`,
    `${PREFIX}:driver:test_driver_2`,
    `${PREFIX}:driver:test_driver_3`,
    `${PREFIX}:driver:test_driver_4`,
    `${PREFIX}:driver:test_driver_5`,
    `${PREFIX}:processed:test_event_1`,
    `${PREFIX}:processed:test_event_2`,
    `${PREFIX}:processed:test_event_3`,
    `${PREFIX}:processed:test_event_4`,
    `${PREFIX}:processed:test_event_5`,
    `${PREFIX}:processed:test_event_6`
];

describe("Redis Counter Integration Tests", () => {

    beforeAll(async () => {
        await connectRedis();
    });

    beforeEach(async () => {
        await redisClient.del(testKeys);
    });

    afterAll(async () => {
        await redisClient.del(testKeys);

        if (redisClient.isOpen) {
            await redisClient.quit();
        }
    });

    test("should increase cell count when a driver becomes available", async () => {
        const result = await applyDriverTransition({
            eventId: "test_event_1",
            driverId: "test_driver_1",
            fromCell: null,
            toCell: "cell_A",
            fromStatus: null,
            toStatus: "available",
            stateVersion: 1
        });

        expect(result.applied).toBe(true);
        expect(await getCellCount("cell_A")).toBe(1);
    });

    test("should decrease count when driver becomes busy", async () => {
        await applyDriverTransition({
            eventId: "test_event_1",
            driverId: "test_driver_1",
            fromCell: null,
            toCell: "cell_A",
            fromStatus: null,
            toStatus: "available",
            stateVersion: 1
        });

        const result = await applyDriverTransition({
            eventId: "test_event_2",
            driverId: "test_driver_1",
            fromCell: "cell_A",
            toCell: "cell_A",
            fromStatus: "available",
            toStatus: "busy",
            stateVersion: 2
        });

        expect(result.applied).toBe(true);
        expect(await getCellCount("cell_A")).toBe(0);
    });

    test("should move availability from old cell to new cell", async () => {
        await applyDriverTransition({
            eventId: "test_event_1",
            driverId: "test_driver_1",
            fromCell: null,
            toCell: "cell_A",
            fromStatus: null,
            toStatus: "available",
            stateVersion: 1
        });

        const result = await applyDriverTransition({
            eventId: "test_event_2",
            driverId: "test_driver_1",
            fromCell: "cell_A",
            toCell: "cell_B",
            fromStatus: "available",
            toStatus: "available",
            stateVersion: 2
        });

        expect(result.applied).toBe(true);
        expect(await getCellCount("cell_A")).toBe(0);
        expect(await getCellCount("cell_B")).toBe(1);
    });

    test("should not apply the same event twice", async () => {
        const event = {
            eventId: "test_event_1",
            driverId: "test_driver_1",
            fromCell: null,
            toCell: "cell_A",
            fromStatus: null,
            toStatus: "available",
            stateVersion: 1
        };

        const firstResult = await applyDriverTransition(event);
        const secondResult = await applyDriverTransition(event);

        expect(firstResult.applied).toBe(true);
        expect(secondResult.applied).toBe(false);
        expect(secondResult.duplicate).toBe(true);

        expect(await getCellCount("cell_A")).toBe(1);
    });

    test("should ignore an older stateVersion", async () => {
        await applyDriverTransition({
            eventId: "test_event_1",
            driverId: "test_driver_1",
            fromCell: null,
            toCell: "cell_A",
            fromStatus: null,
            toStatus: "available",
            stateVersion: 5
        });

        const result = await applyDriverTransition({
            eventId: "test_event_2",
            driverId: "test_driver_1",
            fromCell: "cell_A",
            toCell: "cell_B",
            fromStatus: "available",
            toStatus: "available",
            stateVersion: 3
        });

        expect(result.applied).toBe(false);
        expect(await getCellCount("cell_A")).toBe(1);
        expect(await getCellCount("cell_B")).toBe(0);
    });

    test("should prevent a counter from becoming negative", async () => {
        await applyDriverTransition({
            eventId: "test_event_1",
            driverId: "test_driver_1",
            fromCell: null,
            toCell: "cell_A",
            fromStatus: null,
            toStatus: "available",
            stateVersion: 1
        });

        // Simulate inconsistent Redis counter data.
        await redisClient.hDel(COUNTS_KEY, "cell_A");

        await expect(
            applyDriverTransition({
                eventId: "test_event_2",
                driverId: "test_driver_1",
                fromCell: "cell_A",
                toCell: "cell_A",
                fromStatus: "available",
                toStatus: "busy",
                stateVersion: 2
            })
        ).rejects.toThrow(/COUNTER_UNDERFLOW/);

        // Failed transition must not update driver state.
        const driverState = await redisClient.hGetAll(
            `${PREFIX}:driver:test_driver_1`
        );

        expect(driverState.status).toBe("available");
        expect(driverState.stateVersion).toBe("1");
    });

});