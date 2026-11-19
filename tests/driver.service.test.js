require("dotenv").config();

const mongoose = require("mongoose");

const Driver = require("../src/models/Driver");
const OutboxEvent = require("../src/models/OutboxEvent");

const {
    updateDriverLocation
} = require("../src/services/driver.service");

describe("Driver Location Service Integration Tests", () => {

    const basePayload = {
        driverId: "test_driver_101",
        latitude: 28.6139,
        longitude: 77.2090,
        timestamp: "2026-11-04T08:00:00.000Z",
        sequenceNumber: 1,
        status: "available"
    };

    beforeAll(async () => {
        if (!process.env.TEST_MONGODB_URI) {
            throw new Error("TEST_MONGODB_URI is missing in .env");
        }

        await mongoose.connect(process.env.TEST_MONGODB_URI);

        if (mongoose.connection.name !== "geopulse_test") {
            throw new Error(
                `Wrong test database: ${mongoose.connection.name}`
            );
        }

        await Driver.init();
        await OutboxEvent.init();
    });

    beforeEach(async () => {
        await Driver.deleteMany({});
        await OutboxEvent.deleteMany({});
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    test("should create a new driver and outbox event", async () => {
        const result = await updateDriverLocation(basePayload);

        const driver = await Driver.findOne({
            driverId: basePayload.driverId
        });

        const event = await OutboxEvent.findOne({
            eventId: "test_driver_101:1"
        });

        expect(result.accepted).toBe(true);
        expect(result.duplicate).toBe(false);

        expect(driver).not.toBeNull();
        expect(driver.status).toBe("available");
        expect(driver.lastSequenceNumber).toBe(1);

        expect(event).not.toBeNull();
        expect(event.status).toBe("pending");
    });

    test("should accept a newer location update", async () => {
        await updateDriverLocation(basePayload);

        const result = await updateDriverLocation({
            ...basePayload,
            latitude: 28.6200,
            longitude: 77.2100,
            sequenceNumber: 2,
            timestamp: "2026-11-04T08:01:00.000Z"
        });

        const driver = await Driver.findOne({
            driverId: basePayload.driverId
        });

        expect(result.accepted).toBe(true);
        expect(driver.lastSequenceNumber).toBe(2);
        expect(driver.location.coordinates).toEqual([
            77.2100,
            28.6200
        ]);
    });

    test("should ignore an older sequence number", async () => {
        await updateDriverLocation({
            ...basePayload,
            sequenceNumber: 2
        });

        const result = await updateDriverLocation({
            ...basePayload,
            sequenceNumber: 1
        });

        const driver = await Driver.findOne({
            driverId: basePayload.driverId
        });

        expect(result.accepted).toBe(false);
        expect(driver.lastSequenceNumber).toBe(2);

        const events = await OutboxEvent.countDocuments({
            driverId: basePayload.driverId
        });

        expect(events).toBe(1);
    });

    test("should identify an exact duplicate event", async () => {
        await updateDriverLocation(basePayload);

        const result = await updateDriverLocation(basePayload);

        expect(result.accepted).toBe(true);
        expect(result.duplicate).toBe(true);

        const events = await OutboxEvent.countDocuments({
            eventId: "test_driver_101:1"
        });

        expect(events).toBe(1);
    });

    test("should reject the same sequence with a different payload", async () => {
        await updateDriverLocation(basePayload);

        const conflictingPayload = {
            ...basePayload,
            latitude: 28.7000
        };

        await expect(
            updateDriverLocation(conflictingPayload)
        ).rejects.toMatchObject({
            statusCode: 409
        });

        const driver = await Driver.findOne({
            driverId: basePayload.driverId
        });

        expect(driver.lastSequenceNumber).toBe(1);
        expect(driver.location.coordinates).toEqual([
            77.2090,
            28.6139
        ]);
    });

    test("should correctly process available to busy transition", async () => {
        await updateDriverLocation(basePayload);

        const result = await updateDriverLocation({
            ...basePayload,
            sequenceNumber: 2,
            status: "busy",
            timestamp: "2026-11-04T08:01:00.000Z"
        });

        const driver = await Driver.findOne({
            driverId: basePayload.driverId
        });

        const event = await OutboxEvent.findOne({
            eventId: "test_driver_101:2"
        });

        expect(result.accepted).toBe(true);
        expect(driver.status).toBe("busy");

        expect(event.fromStatus).toBe("available");
        expect(event.toStatus).toBe("busy");
    });

});