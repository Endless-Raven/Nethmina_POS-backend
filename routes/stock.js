const express = require("express");

const {manageStock , getStockByProductAndStore } = require("../controllers/stock");

const router = express.Router();



router.post("/",manageStock ); // transfer stock 

router.get("/getStockDetails",getStockByProductAndStore ); //get stock by product and store
// router.get("/:store_name",getstorebyname);
// router.put("/:store_name",updatestorebyname);


module.exports = router;