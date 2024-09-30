const express = require("express");

const { makesale} = require("../controllers/sales");

const router = express.Router();



router.post("/",makesale );

module.exports = router;

