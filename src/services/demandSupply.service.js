const { redisClient } = require("../config/redis");

const DEMAND_KEY = "geopulse:{live}:cell:demand";

const recordRideRequest = async (h3Cell) => {
    if (!redisClient.isReady) {
        const error = new Error("Demand data is temporarily unavailable");
        error.statusCode = 503;
        throw error;
    }

    const demand = await redisClient.hIncrBy(
        DEMAND_KEY,
        h3Cell,
        1
    );

    return {
        h3Cell,
        demand
    };
};

module.exports = {
    recordRideRequest
};