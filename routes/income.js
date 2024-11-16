const express = require("express");

const {
  addIncome,
  getIncomes,
  getIncomeById,
  addIncomeCategoryAndAmount,
  getIncomeCategoryAndAmount,
  updateIncome,
  deleteIncome,
  getPendingIncomes,
  approveIncome,
} = require("../controllers/income");

const router = express.Router();

// Route for adding a new income
router.post("/AddIncome", addIncome);

// Route for adding income category and amount
router.post("/AddIncomeCategory", addIncomeCategoryAndAmount);

// Route for getting all incomes
router.get("/getAllIncome", getIncomes);

// Route for getting income by ID
router.get("/getIncomeById/:income_id", getIncomeById);

//route for categories and amounts
router.get("/getIncomeByCategoryandAmount", getIncomeCategoryAndAmount);

// Route for updating income
router.put("/updateIncome/:income_id", updateIncome);

// Route for deleting income
router.delete("/deleteIncome/:income_id", deleteIncome);

router.get("/getPendingIncomes", getPendingIncomes);

router.post("/approve", approveIncome);

module.exports = router;
