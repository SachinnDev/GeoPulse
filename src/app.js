const express = require("express");

const cors = require("cors");
const app = express();

const driverRoutes = require("./routes/driver.routes");
const heatmapRoutes = require("./routes/heatmap.routes");
const errorMiddleware = require("./middleware/error.middleware");
const demandSupplyRoutes = require("./routes/demandSupply.routes");

app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173"
}));

// Global middleware
app.use(express.json());

// Health check
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "GeoPulse API is running"
    });
});

// Driver routes
app.use("/api/drivers", driverRoutes);
app.use("/api/heatmap", heatmapRoutes);
app.use("/api/demand-supply", demandSupplyRoutes);
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found"
    });
});

// Error handler - must be last
app.use(errorMiddleware);

module.exports = app;