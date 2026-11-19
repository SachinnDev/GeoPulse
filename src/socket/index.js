const { Server } = require("socket.io");

let io;

const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL || "http://localhost:5173",
            methods: ["GET", "POST"]
        }
    });

    io.on("connection", (socket) => {
        console.log("Dashboard connected:", socket.id);

        // Dashboard subscribes to live heatmap updates.
        socket.on("heatmap:subscribe", () => {
            socket.join("heatmap");

            socket.emit("heatmap:subscribed", {
                success: true,
                message: "Subscribed to live heatmap updates"
            });
        });

        socket.on("disconnect", (reason) => {
            console.log(
                "Dashboard disconnected:",
                socket.id,
                reason
            );
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error("Socket.IO has not been initialized");
    }

    return io;
};

module.exports = {
    initSocket,
    getIO
};