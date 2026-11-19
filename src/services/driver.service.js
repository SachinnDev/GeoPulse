const mongoose = require("mongoose");
const crypto = require("crypto");

const Driver = require("../models/Driver");
const OutboxEvent = require("../models/OutboxEvent");

const { getH3Cell } = require("../utils/h3");

const updateDriverLocation = async ({
    driverId,
    latitude,
    longitude,
    timestamp,
    sequenceNumber,
    status
}) => {
    const locationTime = new Date(timestamp);
    const now = new Date();

    const h3Cell = getH3Cell(latitude, longitude);

    // Same event payload must produce the same fingerprint.
    const eventFingerprint = crypto
        .createHash("sha256")
        .update(JSON.stringify({
            driverId,
            latitude,
            longitude,
            timestamp: locationTime.toISOString(),
            sequenceNumber,
            status
        }))
        .digest("hex");

    const eventId = `${driverId}:${sequenceNumber}`;

    const isNewerUpdate = {
        $gt: [
            { $literal: sequenceNumber },
            { $ifNull: ["$lastSequenceNumber", -1] }
        ]
    };
    const nextStateVersion = {
    $add: [
        {
            $ifNull: [
                "$stateVersion",
                { $ifNull: ["$lastSequenceNumber", 0] }
            ]
        },
        1
    ]
};
    const updatePipeline = [
        {
            $set: {
                driverId: { $literal: driverId },

                lastTransition: {
                    $cond: [
                        isNewerUpdate,
                        {
                            fromCell: {
                                $ifNull: ["$h3Cell", null]
                            },
                            toCell: { $literal: h3Cell },

                            fromStatus: {
                                $ifNull: ["$status", null]
                            },
                            toStatus: { $literal: status },

                            sequenceNumber: {
                                $literal: sequenceNumber
                            },
                            eventTime: {
                                $literal: locationTime
                            },
                            stateVersion: nextStateVersion
                        },
                        "$lastTransition"
                    ]
                },

                lastEventFingerprint: {
                    $cond: [
                        isNewerUpdate,
                        { $literal: eventFingerprint },
                        "$lastEventFingerprint"
                    ]
                },

                location: {
                    $cond: [
                        isNewerUpdate,
                        {
                            $literal: {
                                type: "Point",
                                coordinates: [longitude, latitude]
                            }
                        },
                        "$location"
                    ]
                },

                h3Cell: {
                    $cond: [
                        isNewerUpdate,
                        { $literal: h3Cell },
                        "$h3Cell"
                    ]
                },

                status: {
                    $cond: [
                        isNewerUpdate,
                        { $literal: status },
                        "$status"
                    ]
                },

                lastSequenceNumber: {
                    $cond: [
                        isNewerUpdate,
                        { $literal: sequenceNumber },
                        "$lastSequenceNumber"
                    ]
                },
                stateVersion: {
                    $cond: [
                       isNewerUpdate,
                       nextStateVersion,
                       "$stateVersion"
    ]
},
                lastLocationUpdate: {
                    $cond: [
                        isNewerUpdate,
                        { $literal: locationTime },
                        "$lastLocationUpdate"
                    ]
                },

                updatedAt: {
                    $cond: [
                        isNewerUpdate,
                        { $literal: now },
                        "$updatedAt"
                    ]
                },

                createdAt: {
                    $ifNull: [
                        "$createdAt",
                        { $literal: now }
                    ]
                }
            }
        }
    ];

    // Run transaction. If concurrent first-time upserts
    // collide, retry without upsert.
    const runTransaction = async (allowUpsert) => {
        const session = await mongoose.startSession();

        let result;

        try {
            await session.withTransaction(async () => {
                result = null;

                const driver = await Driver.findOneAndUpdate(
                    { driverId },
                    updatePipeline,
                    {
                        upsert: allowUpsert,
                        returnDocument: "after",
                        updatePipeline: true,
                        session
                    }
                );

                if (!driver) {
                    throw new Error("Driver update returned no document");
                }

                // An older event must not create a new outbox event.
                if (driver.lastSequenceNumber !== sequenceNumber) {
                    result = {
                        accepted: false,
                        duplicate: false,
                        transition: null,
                        outboxEventId: null,
                        driver
                    };

                    return;
                }

                // Same sequence with a different payload is a conflict.
                if (driver.lastEventFingerprint !== eventFingerprint) {
                    const error = new Error(
                        "Sequence number already used with a different payload"
                    );
                    error.statusCode = 409;
                    throw error;
                }

                // Check whether this event was already recorded.
                const existingEvent = await OutboxEvent.findOne({
                    eventId
                })
                    .session(session)
                    .lean();

                if (existingEvent) {
                    if (
                        existingEvent.eventFingerprint !== eventFingerprint
                    ) {
                        const error = new Error(
                            "Conflicting outbox event detected"
                        );
                        error.statusCode = 409;
                        throw error;
                    }

                    result = {
                        accepted: true,
                        duplicate: true,
                        transition: existingEvent,
                        outboxEventId: eventId,
                        driver
                    };

                    return;
                }

                const transition = driver.lastTransition;

                if (
                    !transition ||
                    transition.sequenceNumber !== sequenceNumber ||
                      !Number.isSafeInteger(transition.stateVersion)
                ) {
                    throw new Error(
                        "Driver transition could not be verified"
                    );
                }

                // Insert event in the SAME MongoDB transaction.
                await OutboxEvent.create(
                    [{
                        eventId,
                        driverId,
                        sequenceNumber,
                        stateVersion: transition.stateVersion,
                        eventType: "DRIVER_STATE_CHANGED",

                        fromCell: transition.fromCell,
                        toCell: transition.toCell,

                        fromStatus: transition.fromStatus,
                        toStatus: transition.toStatus,

                        eventTime: transition.eventTime,
                        eventFingerprint,

                        status: "pending"
                    }],
                    { session }
                );

                result = {
                    accepted: true,
                    duplicate: false,
                    transition,
                    outboxEventId: eventId,
                    driver
                };
            });

            return result;

        } catch (error) {
            // A concurrent upsert or duplicate event may hit
            // a unique index. Retry by looking up the existing driver.
            if (error.code === 11000 && allowUpsert) {
                return await runTransaction(false);
            }

            throw error;

        } finally {
            await session.endSession();
        }
    };

    return runTransaction(true);
};

module.exports = {
    updateDriverLocation
};