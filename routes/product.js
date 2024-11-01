const express = require("express");

const { additem ,
    getitembyid ,
    getitems ,
    updateitem ,
    deleteitem ,
    getProductTypes ,
     getBrandsByProductType ,
      getProductModelsByBrandName , 
      getFilteredProductDetails ,
      searchProductsByName,
      searchProductsByType,
      searchProductsByBrand,
      searchProductsByModel,
      updateStockAndIMEI,
      getProductDetails,
      getitembycode,
      getitembyname,
      getProductforMangerinventory
    } = require("../controllers/product");


const router = express.Router();


router.post("/",additem ); //add item
router.get("/", getitems );//get items

router.get("/:product_name",getitembyid );// get item by id
router.get("/productCode/:product_code",getitembycode );// get item by code
router.get("/productName/:product_name",getitembyname );// get item by name

router.put("/:product_name",updateitem ); //update item details 
router.delete("/:product_name",deleteitem); //delete item

router.get("/getProductTypes/get",getProductTypes); //get product type list for POS
router.get("/brands/byproducttype",getBrandsByProductType); //get brand list for POS
router.get("/models/bybrand",getProductModelsByBrandName); //get models list for POS

router.get("/inventory/stock",getProductforMangerinventory); //get products for manger inventory


router.post("/getFiltered/ProductDetails",getFilteredProductDetails); //get products filterd for inventory



router.get("/searchProductsBy/Name",searchProductsByName); //get products name for search bar
router.get("/searchProductsBy/Type",searchProductsByType); //get products Type for search bar
router.get("/searchProductsBy/Brand",searchProductsByBrand); //get products Brand for search bar
router.get("/searchProductsBy/Model",searchProductsByModel); //get products Model for search bar



router.put("/updateStockAndIMEI/:product_name",updateStockAndIMEI ); //update item StockAndIMEI 

router.get("/track/ProductDetails",getProductDetails ); //update item StockAndIMEI 



module.exports = router;



