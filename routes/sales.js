const express = require("express");

const { makesale ,getsales , getsalebyid} = require("../controllers/sales");

const router = express.Router();



router.post("/",makesale );
router.get("/",getsales );
router.get("/:sale_id",getsalebyid );


module.exports = router;

