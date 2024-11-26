const express = require("express");

const {
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
     getAllPendingRequests,
     markRequestAsRead,
     getProductDetailsByIMEIOrCode,
     markTransferAsRead,
     getAllPendingRequestsbyreqfrom,
     cancelTransfer,
     getTransfersFromStore,
     deleteProductOrIMEI} = require("../controllers/stock");

const router = express.Router();

router.post('/PendingRequests/byid', getAllPendingRequestsbyreqfrom);//get All Pending Requests details by id
router.get("/getStockDetails",getStockByProductAndStore ); //get stock by product and store

router.get('/getStoresAndCategories', getStoresAndCategories);//get all stores and categories
router.get('/getBrandsByCategory/:category', getBrandsByCategory);//get the brands of a category
router.get('/getProductsByCategoryAndBrand', getProductsByCategoryAndBrand);//get all products by category and brand
router.post('/transferStock', transferStock);

router.post('/cancel/transferStock', cancelTransfer);

router.get('/getAllPendingRequests', getAllPendingRequests);//get All Pending Requests details
router.get('/markRequestAsRead', markRequestAsRead);//get All Pending Requests details
router.get('/getTransferDetails', getTransferDetails);//get All Pending Requests details


router.post("/requestproduct", requestProduct);            //sent product request
router.get("/getProductRequests", getProductRequests);     //get product requests 4
router.delete("/deleteRequest", deleteRequest);             //delete reqest
router.get("/getallTransfers", getAllTransfers);            //get all transfer details
router.get("/getTransfers/bystore", getTransfersFromStore);  
router.put("/markTransferAsRead", markTransferAsRead);      //mark as read transfer request

router.post('/delete/productimei'  ,deleteProductOrIMEI);

router.post('/details/byimie', getProductDetailsByIMEIOrCode);

// router.get("/:store_name",getstorebyname);
// router.put("/:store_name",updatestorebyname);


module.exports = router;
