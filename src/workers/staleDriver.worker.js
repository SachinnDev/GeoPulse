const {
    findAndMarkOneStaleDriver
} = require("../services/staleDriver.service");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let workerStarted = false;

const processStaleDrivers = async ({
    staleAfterMs,
    pollIntervalMs
}) => {
    console.log("GeoPulse Stale Driver Worker started");
    console.log(`Stale threshold: ${staleAfterMs / 1000} seconds`);

    while (true) {
        try {
            const markedOffline =
                await findAndMarkOneStaleDriver(staleAfterMs);

            if (markedOffline) {
                console.log("A stale driver was marked offline");
            } else {
                await sleep(pollIntervalMs);
            }
        } catch (error) {
            console.error(
                "Stale driver worker error:",
                error.message
            );

            await sleep(pollIntervalMs);
        }
    }
};

const startStaleDriverWorker = ({
    staleAfterMs = 30000,
    pollIntervalMs = 5000
} = {}) => {
    if (workerStarted) return;

    workerStarted = true;

    processStaleDrivers({
        staleAfterMs,
        pollIntervalMs
    }).catch((error) => {
        console.error(
            "Stale driver worker stopped:",
            error.message
        );

        workerStarted = false;
    });
};

module.exports = {
    startStaleDriverWorker
};