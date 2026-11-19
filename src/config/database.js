
const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            maxPoolSize: 20,
            serverSelectionTimeoutMS: 10000,
            autoIndex: process.env.NODE_ENV !== "production"
        });

        console.log(`MongoDB connected: ${mongoose.connection.name}`);

    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        throw error;
    }
};

mongoose.connection.on("disconnected", () => {
    console.error("MongoDB disconnected");
});

mongoose.connection.on("error", (error) => {
    console.error("MongoDB connection error:", error.message);
});

module.exports = connectDB;
