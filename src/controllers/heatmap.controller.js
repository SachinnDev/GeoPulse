const {
    getHeatmapData
} = require("../services/heatmap.service");

const getHeatmap = async (req, res, next) => {
    try {
        const heatmap = await getHeatmapData();

        res.status(200).json({
            success: true,
            data: heatmap
        });

    } catch (error) {
        next(error);
    }
};

module.exports = {
    getHeatmap
};