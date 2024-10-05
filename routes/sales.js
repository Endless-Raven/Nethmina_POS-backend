const express = require("express");

const { makesale ,getsales , getsalebyid ,getDailySalesReport , getSalesItemsByDate} = require("../controllers/sales");

const router = express.Router();



router.post("/",makesale ); // make a bill
router.get("/",getsales ); // get sales 
router.get("/daily-sales-report",getDailySalesReport ); // get daily sales report
router.get("/:sale_id",getsalebyid ); //get sele by id


router.get("/getSalesItems/ByDate",getSalesItemsByDate ); //get sele details by date

module.exports = router;

