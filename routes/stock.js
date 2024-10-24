const express = require("express");

const {
  manageStock,
  getStockByProductAndStore,
  requestProduct,
  getProductRequests,
  deleteRequest,
  getAllTransfers,
  markTransferAsRead,
} = require("../controllers/stock");

const router = express.Router();

router.post("/", manageStock); // transfer stock

router.get("/getStockDetails", getStockByProductAndStore); //get stock by product and store
// router.get("/:store_name",getstorebyname);
// router.put("/:store_name",updatestorebyname);

router.post("/requestproduct", requestProduct);            //sent product request
router.get("/getProductRequests", getProductRequests);     //get product requests 4
router.delete("/deleteRequest", deleteRequest);             //delete reqest
router.get("/getallTransfers", getAllTransfers);            //get all transfer details
router.put("/markTransferAsRead", markTransferAsRead);      //mark as read transfer request

module.exports = router;
