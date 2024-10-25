const express = require("express");
const router = express.Router();
const { getMonthlyReport, getDailyReport } = require("../controllers/monthly_report");

router.get("/monthly-report", getMonthlyReport); // Monthly report route
router.get("/daily-report", getDailyReport); // Daily report route

module.exports = router;