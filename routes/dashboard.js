const express = require("express");

const {getDashboardData } = require("../controllers/dashboard");

const router = express.Router();


router.get("/getDashboard",getDashboardData ); //get dashboard details

module.exports = router;