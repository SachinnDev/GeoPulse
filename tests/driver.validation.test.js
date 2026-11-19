
const request = require("supertest");

// Mock driver service so tests don't need MongoDB or Redis.
jest.mock("../src/services/driver.service", () => ({
    updateDriverLocation: jest.fn()
}));

const app = require("../src/app");
const driverService = require("../src/services/driver.service");

describe("Driver Location API Validation", () => {

    const validPayload = {
        driverId: "test_driver_101",
        latitude: 28.6139,
        longitude: 77.2090,
        timestamp: "2026-11-04T08:00:00.000Z",
        sequenceNumber: 1,
        status: "available"
    };

    beforeEach(() => {
        jest.clearAllMocks();

        driverService.updateDriverLocation.mockResolvedValue({
            accepted: true,
            driver: {
                driverId: "test_driver_101",
                status: "available"
            }
        });
    });

    test("should accept valid driver location data", async () => {
        const response = await request(app)
            .post("/api/drivers/location")
            .send(validPayload);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.accepted).toBe(true);

        expect(
            driverService.updateDriverLocation
        ).toHaveBeenCalledTimes(1);
    });

    test("should reject an empty driverId", async () => {
        const response = await request(app)
            .post("/api/drivers/location")
            .send({
                ...validPayload,
                driverId: ""
            });

        expect(response.status).toBe(400);

        expect(
            driverService.updateDriverLocation
        ).not.toHaveBeenCalled();
    });

    test("should reject invalid latitude", async () => {
        const response = await request(app)
            .post("/api/drivers/location")
            .send({
                ...validPayload,
                latitude: 100
            });

        expect(response.status).toBe(400);

        expect(
            driverService.updateDriverLocation
        ).not.toHaveBeenCalled();
    });

    test("should reject invalid longitude", async () => {
        const response = await request(app)
            .post("/api/drivers/location")
            .send({
                ...validPayload,
                longitude: 200
            });

        expect(response.status).toBe(400);

        expect(
            driverService.updateDriverLocation
        ).not.toHaveBeenCalled();
    });

    test("should reject negative sequenceNumber", async () => {
        const response = await request(app)
            .post("/api/drivers/location")
            .send({
                ...validPayload,
                sequenceNumber: -1
            });

        expect(response.status).toBe(400);

        expect(
            driverService.updateDriverLocation
        ).not.toHaveBeenCalled();
    });

    test("should reject invalid timestamp", async () => {
        const response = await request(app)
            .post("/api/drivers/location")
            .send({
                ...validPayload,
                timestamp: "not-a-date"
            });

        expect(response.status).toBe(400);

        expect(
            driverService.updateDriverLocation
        ).not.toHaveBeenCalled();
    });

    test("should reject invalid driver status", async () => {
        const response = await request(app)
            .post("/api/drivers/location")
            .send({
                ...validPayload,
                status: "driving"
            });

        expect(response.status).toBe(400);

        expect(
            driverService.updateDriverLocation
        ).not.toHaveBeenCalled();
    });
});
