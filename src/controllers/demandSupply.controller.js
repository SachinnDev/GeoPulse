const { getH3Cell } = require("../utils/h3");

const {
    recordRideRequest
} = require("../services/demandSupply.service");

const {
    getDemandSupplyAnalysis
} = require("../services/demandSupplyAnalysis.service");
const createRideRequest = async (req, res, next) => {
    try {
        const latitude = Number(req.body.latitude);
        const longitude = Number(req.body.longitude);

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

        const h3Cell = getH3Cell(latitude, longitude);

        const result = await recordRideRequest(h3Cell);

        return res.status(201).json({
            success: true,
            message: "Ride request recorded",
            data: result
        });

    } catch (error) {
        next(error);
    }
};

   const getDemandSupply = async (req, res, next) => {
    try {
        const result = await getDemandSupplyAnalysis();

        return res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        next(error);
    }
};

module.exports = {
    createRideRequest ,getDemandSupply
};