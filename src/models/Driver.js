
const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema(
    {
        driverId: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        location: {
            type: {
                type: String,
                enum: ["Point"],
                required: true
            },

            coordinates: {
                type: [Number],
                required: true
            }
        },

        status: {
            type: String,
            enum: ["available", "busy", "offline"],
            default: "offline",
            required: true
        },

        h3Cell: {
            type: String,
            required: true
        },
        lastTransition: {
        type: mongoose.Schema.Types.Mixed,
        default: null
        },
        lastEventFingerprint: {
        type: String,
        default: null
         },
        lastSequenceNumber: {
            type: Number,
            required: true,
            min: 0
        },
        stateVersion: {
        type: Number,
        required: true,
        min: 0,
        default: 0
        },

        lastLocationUpdate: {
            type: Date,
            required: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }

);

// Geospatial queries
driverSchema.index({
    location: "2dsphere"
});

// Find drivers inside an H3 cell by status
driverSchema.index({
    h3Cell: 1,
    status: 1
});

// Find recently updated drivers by status
driverSchema.index({
    status: 1,
    lastLocationUpdate: -1
});

module.exports = mongoose.model("Driver", driverSchema);
