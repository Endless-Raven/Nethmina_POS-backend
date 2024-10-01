const express = require("express");

const {addStore ,getStore , getstorebyname , updatestorebyname } = require("../controllers/stores");

const router = express.Router();



router.post("/",addStore );
router.get("/",getStore );
router.get("/:store_name",getstorebyname);
router.put("/:store_name",updatestorebyname);


module.exports = router;