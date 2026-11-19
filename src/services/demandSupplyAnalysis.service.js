const { redisClient } = require("../config/redis");

const DEMAND_KEY = "geopulse:{live}:cell:demand";
const SUPPLY_KEY = "geopulse:{live}:cell:counts";

const getDemandSupplyAnalysis = async () => {
    if (!redisClient.isReady) {
        const error = new Error(
            "Demand and supply data is temporarily unavailable"
        );

        error.statusCode = 503;
        throw error;
    }

    const [demandData, supplyData] = await Promise.all([
        redisClient.hGetAll(DEMAND_KEY),
        redisClient.hGetAll(SUPPLY_KEY)
    ]);

    const allCells = new Set([
        ...Object.keys(demandData),
        ...Object.keys(supplyData)
    ]);

    const cells = [];

    for (const h3Cell of allCells) {
        const demand = Number(demandData[h3Cell] || 0);
        const supply = Number(supplyData[h3Cell] || 0);

        let status = "balanced";

        if (demand > supply) {
            status = "high-demand";
        } else if (supply > demand) {
            status = "low-demand";
        }

        cells.push({
            h3Cell,
            demand,
            supply,
            status
        });
    }

    return {
        totalCells: cells.length,
        cells,
        generatedAt: new Date().toISOString()
    };
};

module.exports = {
    getDemandSupplyAnalysis
};