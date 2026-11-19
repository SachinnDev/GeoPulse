require("dotenv").config();

const http = require("http");

const app = require("./app");

const connectDB = require("./config/database");

const {
    connectRedis
} = require("./config/redis");

const {
    initSocket
} = require("./socket");

const {
    startOutboxWorker
} = require("./workers/outbox.worker");

const {
    startStaleDriverWorker
} = require("./workers/staleDriver.worker");

const PORT = process.env.PORT || 3000;

const httpServer = http.createServer(app);

const startServer = async () => {
    try {
        await connectDB();

        try {
            await connectRedis();
        } catch (error) {
            console.error(
                "Redis is currently unavailable:",
                error.message
            );
        }

        // Initialize Socket.IO before starting the worker.
        initSocket(httpServer);

        httpServer.listen(PORT, () => {
            console.log(`GeoPulse running on port ${PORT}`);

            startOutboxWorker();
             startStaleDriverWorker({
        staleAfterMs: 30000,
        pollIntervalMs: 5000
    });
        });

    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
};

startServer();