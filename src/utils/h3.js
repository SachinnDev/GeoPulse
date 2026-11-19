
const { latLngToCell } = require("h3-js");

const H3_RESOLUTION = Number(
    process.env.H3_RESOLUTION || 9
);

if (
    !Number.isInteger(H3_RESOLUTION) ||
    H3_RESOLUTION < 0 ||
    H3_RESOLUTION > 15
) {
    throw new Error("Invalid H3_RESOLUTION. Use a value between 0 and 15.");
}

const getH3Cell = (latitude, longitude) => {
    return latLngToCell(
        latitude,
        longitude,
        H3_RESOLUTION
    );
};

module.exports = {
    getH3Cell,
    H3_RESOLUTION
};
