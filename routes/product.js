const express = require("express");

const { additem , getitembyid , getitems , updateitem , deleteitem ,getProductTypes , getBrandsByProductType , getProductModelsByBrandName  } = require("../controllers/product");


const router = express.Router();


router.post("/",additem );
router.get("/", getitems );
router.get("/:product_name",getitembyid );
router.put("/:product_name",updateitem );
router.delete("/:product_name",deleteitem);
router.get("/getProductTypes/get",getProductTypes);
router.get("/brands/byproducttype",getBrandsByProductType);
router.get("/models/bybrand",getProductModelsByBrandName);

module.exports = router;



