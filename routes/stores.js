const express = require("express");

const {addStore ,getStore , getstorebyname , updatestorebyname } = require("../controllers/stores");

const router = express.Router();



router.post("/",addStore );  // ADD new store
router.get("/",getStore ); // get stores

router.get("/:store_name",getstorebyname); //get store by name
router.put("/:store_name",updatestorebyname); // update store by name


module.exports = router;