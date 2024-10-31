const express = require("express");

const { makesale ,getsales , getsalebyid ,getDailySalesReport ,getSalesItemsByDate} = require("../controllers/sales");

const router = express.Router();


router.post("/",makesale );
router.get("/",getsales );
router.get("/getsalebyid/:sale_id",getsalebyid );
router.get("/daily-sales-report",getDailySalesReport );

router.get("/getSalesItems/ByDate",getSalesItemsByDate );//get sele details by date

module.exports = router;

