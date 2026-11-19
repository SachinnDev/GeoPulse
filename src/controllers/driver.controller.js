const driverService = require("../services/driver.service");
const nearbyDriverService = require("../services/nearbyDriver.service");

const updateDriverLocation = async (req, res, next) => {
    try {
        const result = await driverService.updateDriverLocation(
            req.body
        );

        return res.status(200).json({
            success: true,
            accepted: result.accepted,
            message: result.accepted
                ? "Driver location updated"
                : "Stale location update ignored",
            data: result.driver
        });

    } catch (error) {
        next(error);
    }
};

const getNearbyDrivers = async (req, res, next) => {
    try {
        const latitude = Number(req.query.latitude);
        const longitude = Number(req.query.longitude);
        const radius = req.query.radius === undefined
            ? 3000
            : Number(req.query.radius);

        if (
            !Number.isFinite(latitude) ||
            latitude < -90 ||
            latitude > 90
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid latitude"
            });
        }

        if (
            !Number.isFinite(longitude) ||
            longitude < -180 ||
            longitude > 180
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid longitude"
            });
        }

        if (
            !Number.isFinite(radius) ||
            radius <= 0 ||
            radius > 10000
        ) {
            return res.status(400).json({
                success: false,
                message: "Radius must be between 1 and 10000 meters"
            });
        }

        const drivers = await nearbyDriverService.findNearbyDrivers({
            latitude,
            longitude,
            radius
        });

        return res.status(200).json({
            success: true,
            count: drivers.length,
            radiusMeters: radius,
            drivers
        });

    } catch (error) {
        next(error);
    }
};

module.exports = {
    updateDriverLocation,
    getNearbyDrivers
};