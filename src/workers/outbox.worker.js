
const OutboxEvent = require("../models/OutboxEvent");

const {
    applyDriverTransition,
    getCellCount
} = require("../services/redisCounter.service");

const { getIO } = require("../socket");
const { redisClient } = require("../config/redis");

const sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

let workerStarted = false;


// Find and claim one pending event atomically.
const claimNextEvent = async () => {
    const now = new Date();

    return await OutboxEvent.findOneAndUpdate(
        {
            status: "pending",
            $or: [
                { nextAttemptAt: { $lte: now } },
                { nextAttemptAt: null }
            ]
        },
        {
            $set: {
                status: "processing"
            }
        },
        {
            sort: {
                createdAt: 1,
                _id: 1
            },
            returnDocument: "after"
        }
    ).lean();
};


// Retry the exact event that failed.
const scheduleRetry = async (event, error) => {
    const attempts = (event.attempts || 0) + 1;

    const retryDelay = Math.min(
        1000 * (2 ** Math.min(attempts - 1, 5)),
        30000
    );

    const result = await OutboxEvent.updateOne(
        {
            _id: event._id,
            status: "processing"
        },
        {
            $set: {
                status: "pending",
                attempts,
                nextAttemptAt: new Date(
                    Date.now() + retryDelay
                ),
                lastError: String(error.message).slice(0, 2000)
            }
        }
    );

    if (result.modifiedCount === 1) {
        console.log(
            `Retry scheduled: ${event.eventId}, attempt: ${attempts}`
        );
    } else {
        console.log(
            `Retry skipped: ${event.eventId} is no longer processing`
        );
    }
};


// Process one event.
const processEvent = async (event) => {

    // Apply transition to Redis.
    const result = await applyDriverTransition(event);

    // Find affected H3 cells.
    const affectedCells = [
        ...new Set(
            [event.fromCell, event.toCell].filter(Boolean)
        )
    ];

    // Read current cell counts.
    const cellUpdates = await Promise.all(
        affectedCells.map(async (h3Cell) => ({
            h3Cell,
            availableDrivers: await getCellCount(h3Cell)
        }))
    );

    // Mark event as processed.
    const completion = await OutboxEvent.updateOne(
        {
            _id: event._id,
            status: "processing"
        },
        {
            $set: {
                status: "processed",
                processedAt: new Date(),
                lastError: null
            }
        }
    );

    if (completion.modifiedCount !== 1) {
        throw new Error(
            `Could not mark event processed: ${event.eventId}`
        );
    }

    // Notify connected dashboards.
    if (result.applied) {
        try {
            const io = getIO();

            for (const update of cellUpdates) {
                io.to("heatmap").emit("heatmap:cell:update", {
                    ...update,
                    eventId: event.eventId,
                    generatedAt: new Date().toISOString()
                });
            }
        } catch (socketError) {
            console.error(
                "Socket notification failed:",
                socketError.message
            );
        }

        console.log(`Processed event: ${event.eventId}`);
    } else {
        console.log(
            `Duplicate or stale event skipped: ${event.eventId}`
        );
    }
};


// Main worker loop.
const processOutboxEvents = async () => {
    console.log("GeoPulse Outbox Worker started");

    while (true) {
        let event = null;

        try {
            if (!redisClient.isReady) {
                await sleep(1000);
                continue;
            }

            event = await claimNextEvent();

            if (!event) {
                await sleep(1000);
                continue;
            }

            await processEvent(event);

        } catch (error) {
            console.error(
                "Outbox worker error:",
                error.message
            );

            if (event) {
                try {
                    await scheduleRetry(event, error);
                } catch (retryError) {
                    console.error(
                        "Could not schedule retry:",
                        retryError.message
                    );
                }
            }

            await sleep(1000);
        }
    }
};


// Start worker only once.
const startOutboxWorker = () => {
    if (workerStarted) return;

    workerStarted = true;

    processOutboxEvents().catch((error) => {
        console.error(
            "Outbox worker stopped:",
            error.message
        );

        workerStarted = false;
    });
};

module.exports = {
     startOutboxWorker,
    claimNextEvent,
    processEvent
};
