const express = require("express");

const { makesale ,getsales , getsalebyid ,getDailySalesReport} = require("../controllers/sales");

const router = express.Router();



router.post("/",makesale );
router.get("/",getsales );
router.get("/daily-sales-report",getDailySalesReport );
router.get("/:sale_id",getsalebyid );


module.exports = router;

