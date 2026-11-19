
const validateLocation = (req, res, next) => {
    const {
        driverId,
        latitude,
        longitude,
        timestamp,
        sequenceNumber,
        status
    } = req.body;

    if (
        typeof driverId !== "string" ||
        driverId.trim() === ""
    ) {
        return res.status(400).json({
            success: false,
            message: "Valid driverId is required"
        });
    }

    if (
        typeof latitude !== "number" ||
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90
    ) {
        return res.status(400).json({
            success: false,
            message: "Latitude must be between -90 and 90"
        });
    }

    if (
        typeof longitude !== "number" ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
    ) {
        return res.status(400).json({
            success: false,
            message: "Longitude must be between -180 and 180"
        });
    }

    if (
        typeof sequenceNumber !== "number" ||
        !Number.isSafeInteger(sequenceNumber) ||
        sequenceNumber < 0
    ) {
        return res.status(400).json({
            success: false,
            message: "sequenceNumber must be a non-negative safe integer"
        });
    }

    if (
        typeof timestamp !== "string" ||
        !Number.isFinite(Date.parse(timestamp))
    ) {
        return res.status(400).json({
            success: false,
            message: "A valid timestamp is required"
        });
    }

    if (!["available", "busy", "offline"].includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Invalid driver status"
        });
    }

    next();
};

module.exports = validateLocation;
