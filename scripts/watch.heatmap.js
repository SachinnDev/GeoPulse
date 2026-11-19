
const { io } = require("socket.io-client");

// 1. Connect to GeoPulse backend
const socket = io("http://localhost:3000");

// 2. Connection successful
socket.on("connect", () => {
    console.log("Connected to GeoPulse:", socket.id);

    // 3. Subscribe to heatmap updates
    socket.emit("heatmap:subscribe");
});

// 4. Subscription confirmation
socket.on("heatmap:subscribed", (data) => {
    console.log("Subscription successful:", data.message);
});

// 5. Listen for live cell updates
socket.on("heatmap:cell:update", (data) => {
    console.log("\nLIVE HEATMAP UPDATE");
    console.log("-------------------");
    console.log("H3 Cell:", data.h3Cell);
    console.log("Available drivers:", data.availableDrivers);
    console.log("Event:", data.eventId);
});

// 6. Connection error
socket.on("connect_error", (error) => {
    console.error("Socket connection failed:", error.message);
});

// 7. Disconnection
socket.on("disconnect", (reason) => {
    console.log("Disconnected:", reason);
});
