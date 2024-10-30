const express = require("express");

const {getstorenames ,addStore ,getStore , getstorebyname , updatestorebyname, getstorenamebyid,updateStoreById, deleteStore } = require("../controllers/stores");

const router = express.Router();



router.post("/",addStore );  // Add new store
router.get("/",getStore ); // get stores

router.get("/:store_name",getstorebyname); //get store by name
router.put("/:store_name",updatestorebyname); // update store by name

router.get("/getstorename/:store_id",getstorenamebyid); 

router.get("/getstore/names",getstorenames); // get store names for inventory
router.put('/updateStore', updateStoreById); // Use store_id as a path parameter
router.delete('/deleteStore/:store_id', deleteStore); //delete store

module.exports = router;