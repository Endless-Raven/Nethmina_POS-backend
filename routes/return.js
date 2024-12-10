

const express = require("express");

const {addReturnProduct,
    processReturnToStock,
    confirmReturn,
    getReturns,
    getPendingReturnsCount,
    processReturnToStockWithNewExpense,
    addInStockProductToReturn,
    processinStockReturnToStock,
    confirmInStockReturn,
    inStockReturnToStockWithNewExpense} = require("../controllers/return");

const router = express.Router();

router.get('/returns', getReturns);

router.get('/returns/pending-count', getPendingReturnsCount);

router.post('/processReturn/WithExpense', processReturnToStockWithNewExpense);


router.post("/AddReturnInStock",addInStockProductToReturn ); //add in stock product to Return


router.post("/AddReturn",addReturnProduct ); //add Return
router.post("/Tostock",processReturnToStock ); //add to stock Return
router.post("/confirm/Return",confirmReturn ); //confirm Return


router.post("/instock/InstockReturn",confirmInStockReturn ); //confirm instock Return
router.post("/InstockTostock",processinStockReturnToStock ); //add to stock Return
router.post('/processInStockReturn/WithExpense', inStockReturnToStockWithNewExpense);







module.exports = router;

