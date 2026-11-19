const express = require("express");
const router = express.Router();

const {
    getHeatmap
} = require("../controllers/heatmap.controller");

router.get("/", getHeatmap);

module.exports = router;