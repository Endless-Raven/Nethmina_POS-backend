const express = require("express");

const {manageStock ,
     getStockByProductAndStore,
     getStoresAndCategories,
     getBrandsByCategory,
     getProductsByCategoryAndBrand,
     transferStock,
     getTransferDetails,
     requestProduct,
     getProductRequests,
     deleteRequest,
     getAllTransfers,
     markTransferAsRead} = require("../controllers/stock");

const router = express.Router();

router.post("/", manageStock); // transfer stock


router.post("/",manageStock ); // transfer stock 
router.get("/getStockDetails",getStockByProductAndStore ); //get stock by product and store

router.get('/getStoresAndCategories', getStoresAndCategories);//get all stores and categories
router.get('/getBrandsByCategory/:category', getBrandsByCategory);//get the brands of a category
router.get('/getProductsByCategoryAndBrand', getProductsByCategoryAndBrand);//get all products by category and brand
router.post('/transferStock', transferStock);
router.get('/getTransferDetails', getTransferDetails);//get transfer details

router.post("/requestproduct", requestProduct);            //sent product request
router.get("/getProductRequests", getProductRequests);     //get product requests 4
router.delete("/deleteRequest", deleteRequest);             //delete reqest
router.get("/getallTransfers", getAllTransfers);            //get all transfer details
router.put("/markTransferAsRead", markTransferAsRead);      //mark as read transfer request

// router.get("/:store_name",getstorebyname);
// router.put("/:store_name",updatestorebyname);


module.exports = router;
