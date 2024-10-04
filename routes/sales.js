const express = require("express");

const { makesale ,getsales , getsalebyid ,getDailySalesReport} = require("../controllers/sales");

const router = express.Router();



router.post("/",makesale );
router.get("/",getsales );
router.get("/getsalebyid/:sale_id",getsalebyid );
router.get("/daily-sales-report",getDailySalesReport );


module.exports = router;

