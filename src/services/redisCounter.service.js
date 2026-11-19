const { redisClient } = require("../config/redis");

const REDIS_KEY_PREFIX = process.env.REDIS_KEY_PREFIX || "geopulse";
const LIVE_KEY_PREFIX = `${REDIS_KEY_PREFIX}:{live}`;

const getRedisKeys = (event) => ({
    processed: `${LIVE_KEY_PREFIX}:processed:${event.eventId}`,
    counts: `${LIVE_KEY_PREFIX}:cell:counts`,
    driver: `${LIVE_KEY_PREFIX}:driver:${event.driverId}`
});

const APPLY_TRANSITION_SCRIPT = `
    -- 1. Duplicate event check
    if redis.call("EXISTS", KEYS[1]) == 1 then
        return 0
    end

    local oldEventCell = ARGV[1] or ""
    local newCell = ARGV[2] or ""
    local oldEventStatus = ARGV[3] or ""
    local newStatus = ARGV[4] or ""
    local incomingVersion = tonumber(ARGV[5])

    -- 2. Read driver's previous Redis state
    local stateExists = redis.call("EXISTS", KEYS[3]) == 1

    local previousCell
    local previousStatus
    local changes = {}

    if stateExists then
        previousCell = redis.call("HGET", KEYS[3], "cell") or ""
        previousStatus = redis.call("HGET", KEYS[3], "status") or ""

        -- Support older Redis records that only have "sequence"
        local lastVersion = tonumber(
            redis.call("HGET", KEYS[3], "stateVersion")
            or redis.call("HGET", KEYS[3], "sequence")
            or "-1"
        )

        if incomingVersion <= lastVersion then
            redis.call("SET", KEYS[1], "1")
            return 0
        end
    else
        -- Bootstrap previous state from first event
        previousCell = oldEventCell
        previousStatus = oldEventStatus

        if previousStatus == "available" and previousCell ~= "" then
            changes[previousCell] = 1
        end
    end

    -- Remove previous availability contribution
    if previousStatus == "available" and previousCell ~= "" then
        changes[previousCell] = (changes[previousCell] or 0) - 1
    end

    -- Add new availability contribution
    if newStatus == "available" and newCell ~= "" then
        changes[newCell] = (changes[newCell] or 0) + 1
    end

    -- Validate counters before modifying them
    for cell, delta in pairs(changes) do
        local currentCount = tonumber(
            redis.call("HGET", KEYS[2], cell) or "0"
        )

        if currentCount + delta < 0 then
            return redis.error_reply(
                "COUNTER_UNDERFLOW: " .. cell
            )
        end
    end

    -- Apply counter changes atomically
    for cell, delta in pairs(changes) do
        if delta ~= 0 then
            local updatedCount = redis.call(
                "HINCRBY", KEYS[2], cell, delta
            )

            if updatedCount == 0 then
                redis.call("HDEL", KEYS[2], cell)
            end
        end
    end

    -- Save latest driver state
    redis.call(
        "HSET",
        KEYS[3],
        "cell", newCell,
        "status", newStatus,
        "stateVersion", incomingVersion,
        "sequence", incomingVersion
    )

    -- Mark event as processed
    redis.call("SET", KEYS[1], "1")

    return 1
`;

const applyDriverTransition = async (event) => {
    if (!redisClient.isReady) {
        throw new Error("Redis is not ready");
    }

    const version = event.stateVersion ?? event.sequenceNumber;
    const keys = getRedisKeys(event);
    const result = await redisClient.eval(
        APPLY_TRANSITION_SCRIPT,
        {
            keys: [
                 keys.processed,
            keys.counts,
            keys.driver
            ],
            arguments: [
                event.fromCell || "",
                event.toCell || "",
                event.fromStatus || "",
                event.toStatus,
                String(version)
            ]
        }
    );

    return {
        applied: result === 1,
        duplicate: result === 0
    };
};

const getCellCount = async (h3Cell) => {
    if (!redisClient.isReady) {
        throw new Error("Redis is not ready");
    }

    const rawCount = await redisClient.hGet(
        `${LIVE_KEY_PREFIX}:cell:counts`,
        h3Cell
    );

    const count = Number(rawCount ?? 0);

    if (!Number.isSafeInteger(count) || count < 0) {
        throw new Error(`Invalid Redis counter for cell: ${h3Cell}`);
    }

    return count;
};

module.exports = {
    applyDriverTransition,
    getCellCount
};