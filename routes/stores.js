const express = require("express");

const {getstorenames ,addStore ,getStore , getstorebyname , updatestorebyname } = require("../controllers/stores");

const router = express.Router();



router.post("/",addStore );  // ADD new store
router.get("/",getStore ); // get stores

router.get("/:store_name",getstorebyname); //get store by name
router.put("/:store_name",updatestorebyname); // update store by name


router.get("/getstore/names",getstorenames); // get store names for inventory



module.exports = router;