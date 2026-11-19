const express = require("express");

const router = express.Router();

const {updateDriverLocation ,  getNearbyDrivers} = require("../controllers/driver.controller");

const validateLocation = require("../middleware/validateLocation.middleware");

router.post("/location", validateLocation, updateDriverLocation);

router.get("/nearby", getNearbyDrivers);

module.exports = router;