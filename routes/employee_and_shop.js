const express = require("express");
const { getAllShopsAndEmployees } = require("../controllers/employee_and_shop");

const router = express.Router();

router.get("/get_all", getAllShopsAndEmployees); // Route: GET /employee_and_shop/get_all

module.exports = router;
