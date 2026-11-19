const express = require("express");

const router = express.Router();

const {
    createRideRequest ,getDemandSupply
} = require("../controllers/demandSupply.controller");

router.post("/request", createRideRequest);
router.get("/analysis", getDemandSupply);
module.exports = router;