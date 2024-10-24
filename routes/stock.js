const express = require("express");

const {manageStock , getStockByProductAndStore, getStoresAndCategories, getBrandsByCategory, getProductsByCategoryAndBrand, transferStock, getTransferDetails } = require("../controllers/stock");

const router = express.Router();



router.post("/",manageStock ); // transfer stock 
router.get("/getStockDetails",getStockByProductAndStore ); //get stock by product and store
router.get('/getStoresAndCategories', getStoresAndCategories);//get all stores and categories
router.get('/getBrandsByCategory/:category', getBrandsByCategory);//get the brands of a category
router.get('/getProductsByCategoryAndBrand', getProductsByCategoryAndBrand);//get all products by category and brand
router.post('/transferStock', transferStock);
router.get('/getTransferDetails', getTransferDetails);//get transfer details



// router.get("/:store_name",getstorebyname);
// router.put("/:store_name",updatestorebyname);


module.exports = router;