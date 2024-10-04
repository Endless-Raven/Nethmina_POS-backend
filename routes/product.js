const express = require("express");

const { additem , getitembyid , getitems , updateitem , deleteitem ,getProductTypes , getBrandsByProductType , getProductModelsByBrandName , getFilteredProductDetails } = require("../controllers/product");


const router = express.Router();


router.post("/",additem ); //add item
router.get("/", getitems );//get items

router.get("/:product_name",getitembyid );// get item by id
router.put("/:product_name",updateitem ); //update item details 
router.delete("/:product_name",deleteitem); //delete item

router.get("/getProductTypes/get",getProductTypes); //get product type list for POS
router.get("/brands/byproducttype",getBrandsByProductType); //get brand list for POS
router.get("/models/bybrand",getProductModelsByBrandName); //get models list for POS

router.get("/getFilteredProductDetails/get",getFilteredProductDetails); //get products filterd for inventory






module.exports = router;



