const Driver = require("../models/Driver");

const findNearbyDrivers = async ({
    latitude,
    longitude,
    radius = 3000
}) => {
    const drivers = await Driver.aggregate([
        {
            $geoNear: {
                near: {
                    type: "Point",
                    coordinates: [longitude, latitude]
                },
                distanceField: "distanceMeters",
                maxDistance: radius,
                spherical: true,
                query: {
                    status: "available"
                },
                key: "location"
            }
        },
        {
            $limit: 20
        },
        {
            $project: {
                _id: 0,
                driverId: 1,
                distanceMeters: {
                    $round: ["$distanceMeters", 0]
                }
            }
        }
    ]);

    return drivers;
};

module.exports = {
    findNearbyDrivers
};