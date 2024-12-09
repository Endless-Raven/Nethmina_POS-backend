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
      getProductforMangerinventory,
      getProductcolor,
      getImeiNumbers,
      getProductCapacity,
      getitembetails,
      checkimeiInStock,
      getProductModelsByBrandNameStoreName,
      getProductDetailsByID,
      getproductbycode
    } = require("../controllers/product");


const router = express.Router();


router.post("/",additem ); //add item
router.get("/", getitems );//get items

router.get("/productCode/:product_code",getproductbycode );// get item by id
router.get("/:product_id",getitembyid );// get item by id
router.get("/productCode/:product_code/:store_name",getitembycode );// get item by code
router.get("/productName/:product_name",getitembyname );// get item by name
router.get("/productdetails/:product_name",getitembetails );// get item details by name

router.post("/productcode/byID",getProductDetailsByID );// get item details by name


router.put("/:product_id",updateitem ); //update item details 
router.delete("/:product_id",deleteitem); //delete item

router.get("/getProductTypes/get",getProductTypes); //get product type list for POS
router.get("/getProductColor/get",getProductcolor); //get product color list for POS
router.get("/getProductCapacity/get",getProductCapacity); //get product Capacity list for POS


router.get("/brands/byproducttype",getBrandsByProductType); //get brand list for POS
router.get("/models/bybrand",getProductModelsByBrandName); //get models list for POS


router.get("/models/bybrandAndStore",getProductModelsByBrandNameStoreName); //get models list for POS

router.get("/inventory/stock",getProductforMangerinventory); //get products for manger inventory


router.post("/getFiltered/ProductDetails",getFilteredProductDetails); //get products filterd for inventory

router.post("/Imeinumber/list",getImeiNumbers); //get products filterd for inventory


router.get("/searchProductsBy/Name",searchProductsByName); //get products name for search bar
router.get("/searchProductsBy/Type",searchProductsByType); //get products Type for search bar
router.get("/searchProductsBy/Brand",searchProductsByBrand); //get products Brand for search bar
router.get("/searchProductsBy/Model",searchProductsByModel); //get products Model for search bar 



router.put("/updateStockAndIMEI/:product_id",updateStockAndIMEI ); //update item StockAndIMEI 

router.get("/track/ProductDetails",getProductDetails ); //track phone by imei

router.post("/stockin/imei",checkimeiInStock); //check imei



module.exports = router;



