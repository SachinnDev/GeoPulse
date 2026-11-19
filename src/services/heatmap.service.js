const { redisClient } = require("../config/redis");
const { cellToBoundary } = require("h3-js");

const getHeatmapData = async () => {
    if (!redisClient.isReady) {
        const error = new Error("Heatmap data is temporarily unavailable");
        error.statusCode = 503;
        throw error;
    }

    const counts = await redisClient.hGetAll(
        "geopulse:{live}:cell:counts"
    );

    const cells = [];

    for (const [h3Cell, rawCount] of Object.entries(counts)) {
        const availableDrivers = Number(rawCount);

        // Ignore invalid or empty counters.
        if (
            !Number.isSafeInteger(availableDrivers) ||
            availableDrivers <= 0
        ) {
            continue;
        }

        const boundary = cellToBoundary(h3Cell);

        cells.push({
            h3Cell,
            availableDrivers,

            // H3 returns [latitude, longitude].
            boundary: boundary.map(([latitude, longitude]) => ({
                lat: latitude,
                lng: longitude
            }))
        });
    }

    return {
        totalCells: cells.length,
        totalAvailableDrivers: cells.reduce(
            (total, cell) => total + cell.availableDrivers,
            0
        ),
        cells,
        generatedAt: new Date().toISOString()
    };
};

module.exports = {
    getHeatmapData
};