const express = require("express");

const {manageStock , getStockByProductAndStore } = require("../controllers/stock");

const router = express.Router();



router.post("/",manageStock );
router.get("/getStockDetails",getStockByProductAndStore );
// router.get("/:store_name",getstorebyname);
// router.put("/:store_name",updatestorebyname);


module.exports = router;