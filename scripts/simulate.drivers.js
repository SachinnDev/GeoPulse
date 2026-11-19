
const API_URL = "http://localhost:3000/api/drivers/location";

const DRIVER_COUNT = 10;
const UPDATE_INTERVAL = 3000;

// Approximate center of our simulation area
const CENTER = {
    latitude: 28.6139,
    longitude: 77.2090
};

// Unique IDs so repeated simulation runs
// don't conflict with previous drivers.
const runId = Date.now();

const drivers = Array.from(
    { length: DRIVER_COUNT },
    (_, index) => ({
        driverId: `sim_driver_${runId}_${index + 1}`,

        latitude:
            CENTER.latitude + (Math.random() - 0.5) * 0.004,

        longitude:
            CENTER.longitude + (Math.random() - 0.5) * 0.004,

        sequenceNumber: 0,
        status: "available"
    })
);

const sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

const moveDriver = (driver) => {
    // Small random movement to simulate GPS updates
    driver.latitude += (Math.random() - 0.5) * 0.001;
    driver.longitude += (Math.random() - 0.5) * 0.001;

    // Occasionally switch between available and busy
    if (Math.random() < 0.2) {
        driver.status =
            driver.status === "available"
                ? "busy"
                : "available";
    }
};

const sendLocation = async (driver) => {
    try {
        moveDriver(driver);
        driver.sequenceNumber++;

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                driverId: driver.driverId,
                latitude: driver.latitude,
                longitude: driver.longitude,
                timestamp: new Date().toISOString(),
                sequenceNumber: driver.sequenceNumber,
                status: driver.status
            })
        });

        const result = await response.json();

        if (!response.ok || !result.accepted) {
            console.error(
                `Update failed: ${driver.driverId}`,
                result
            );
            return;
        }

        console.log(
            `${driver.driverId} | ` +
            `Status: ${driver.status} | ` +
            `Sequence: ${driver.sequenceNumber}`
        );

    } catch (error) {
        console.error(
            `Request error for ${driver.driverId}:`,
            error.message
        );
    }
};

const startSimulation = async () => {
    console.log("--------------------------------");
    console.log("GeoPulse Driver Simulation");
    console.log(`Simulating ${DRIVER_COUNT} drivers`);
    console.log(`Update interval: ${UPDATE_INTERVAL}ms`);
    console.log("Press CTRL + C to stop");
    console.log("--------------------------------");

    while (true) {
        await Promise.all(
            drivers.map((driver) => sendLocation(driver))
        );

        console.log("--------------------------------");

        await sleep(UPDATE_INTERVAL);
    }
};

startSimulation();
