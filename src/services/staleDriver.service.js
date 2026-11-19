const mongoose = require("mongoose");
const crypto = require("crypto");

const Driver = require("../models/Driver");
const OutboxEvent = require("../models/OutboxEvent");

const markDriverOfflineIfStale = async (candidate, cutoff) => {
    const session = await mongoose.startSession();

    try {
        let result = false;

        await session.withTransaction(async () => {
            const now = new Date();

            const nextStateVersion =
                (candidate.stateVersion ?? candidate.lastSequenceNumber ?? 0) + 1;

            const eventId =
                `${candidate.driverId}:stale:${nextStateVersion}`;

            const eventFingerprint = crypto
                .createHash("sha256")
                .update(JSON.stringify({
                    driverId: candidate.driverId,
                    eventType: "STALE_DRIVER_OFFLINE",
                    stateVersion: nextStateVersion,
                    lastLocationUpdate: candidate.lastLocationUpdate
                }))
                .digest("hex");

            const updatePipeline = [
                {
                    $set: {
                        status: "offline",

                        stateVersion: nextStateVersion,

                        lastTransition: {
                            fromCell: "$h3Cell",
                            toCell: "$h3Cell",
                            fromStatus: "$status",
                            toStatus: "offline",
                            sequenceNumber: "$lastSequenceNumber",
                            stateVersion: nextStateVersion,
                            eventTime: now
                        },

                        updatedAt: now
                    }
                }
            ];

            const driver = await Driver.findOneAndUpdate(
                {
                    _id: candidate._id,
                    status: { $in: ["available", "busy"] },
                    lastLocationUpdate: {
                        $lte: cutoff,
                        $eq: candidate.lastLocationUpdate
                    }
                },
                updatePipeline,
                {
                    returnDocument: "after",
                    updatePipeline: true,
                    session
                }
            );

            // A fresh update or another worker may have changed the driver.
            if (!driver) {
                return;
            }

            await OutboxEvent.create(
                [{
                    eventId,
                    driverId: driver.driverId,
                    sequenceNumber: driver.lastSequenceNumber,
                    stateVersion: driver.stateVersion,

                    eventType: "DRIVER_STATE_CHANGED",

                    fromCell: driver.lastTransition.fromCell,
                    toCell: driver.lastTransition.toCell,

                    fromStatus: driver.lastTransition.fromStatus,
                    toStatus: "offline",

                    eventTime: now,
                    eventFingerprint,

                    status: "pending"
                }],
                { session }
            );

            result = true;
        });

        return result;
    } finally {
        await session.endSession();
    }
};

const findAndMarkOneStaleDriver = async (staleAfterMs) => {
    const cutoff = new Date(Date.now() - staleAfterMs);

    const candidate = await Driver.findOne({
        status: { $in: ["available", "busy"] },
        lastLocationUpdate: { $lte: cutoff }
    })
        .sort({ lastLocationUpdate: 1 })
        .lean();

    if (!candidate) {
        return false;
    }

    return markDriverOfflineIfStale(candidate, cutoff);
};

module.exports = {
    findAndMarkOneStaleDriver
};