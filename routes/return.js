

const express = require("express");

const {addReturnProduct,
    processReturnToStock,
    confirmReturn,
    getReturns,
    getPendingReturnsCount,
    processReturnToStockWithNewExpense} = require("../controllers/return");

const router = express.Router();

router.get('/returns', getReturns);

router.get('/returns/pending-count', getPendingReturnsCount);

router.post('/processReturn/WithExpense', processReturnToStockWithNewExpense);


router.post("/AddReturn",addReturnProduct ); //add Return
router.post("/Tostock",processReturnToStock ); //add to stock Return
router.post("/confirm/Return",confirmReturn ); //confirm Return








module.exports = router;

