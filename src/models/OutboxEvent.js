const mongoose = require("mongoose");

const outboxEventSchema = new mongoose.Schema(
    {
        eventId: {
            type: String,
            required: true,
            unique: true
        },

        driverId: {
            type: String,
            required: true
        },

        sequenceNumber: {
            type: Number,
            required: true
        },

        stateVersion: {
        type: Number,
        required: true,
        min: 1
      },
        eventType: {
            type: String,
            enum: ["DRIVER_STATE_CHANGED"],
            required: true
        },

        fromCell: {
            type: String,
            default: null
        },

        toCell: {
            type: String,
            required: true
        },

        fromStatus: {
            type: String,
            default: null
        },

        toStatus: {
            type: String,
            enum: ["available", "busy", "offline"],
            required: true
        },

        eventTime: {
            type: Date,
            required: true
        },

        eventFingerprint: {
            type: String,
            required: true
        },

        status: {
            type: String,
            enum: ["pending", "processing", "processed", "failed"],
            default: "pending"
        },

        attempts: {
            type: Number,
            default: 0
        },

        nextAttemptAt: {
            type: Date,
            default: Date.now
        },

        processedAt: {
            type: Date,
            default: null
        },

        lastError: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

// Worker will find pending events efficiently.
outboxEventSchema.index({
    status: 1,
    nextAttemptAt: 1,
    createdAt: 1
});

// Useful for querying a driver's event history.
outboxEventSchema.index({
    driverId: 1,
    sequenceNumber: 1
});

module.exports = mongoose.model(
    "OutboxEvent",
    outboxEventSchema
);