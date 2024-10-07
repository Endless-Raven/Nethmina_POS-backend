const express = require("express");
const {
    getCashiers,
    getCashierById,
    getCashierByEmail,
    getCashierByPhoneNumber,
    addCashier,
    updateCashier,
    deleteCashier,
    getCashiersByStoreName,
    getCashiersByStoreId,
    getCashiersnames
} = require("../controllers/cashier");

const router = express.Router();

router.get("/", getCashiers);//get all cashiers
router.get('/cashierID/:id', getCashierById);//get by ID
router.get('/email/:email', getCashierByEmail);//get by email
router.get('/phone/:phone_number', getCashierByPhoneNumber);//get by phone
router.get('/store/:store_name', getCashiersByStoreName);//get by store name
router.get('/cashiers', getCashiersByStoreId);//get by store id

router.get('/cashiersname', getCashiersnames);//get by store names


router.post("/", addCashier);//aad cashier
router.put("/:cashier_id", updateCashier);//update cashier
router.delete("/:cashier_id", deleteCashier);//delete cashier

module.exports = router;
