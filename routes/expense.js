const express = require("express");

const { addExpense, getExpenses, getExpenseById, updateExpense, deleteExpense } = require("../controllers/expense");

const router = express.Router();

// Route for adding a new expense
router.post('/AddExpense', addExpense);

// Route for getting all expenses
router.get('/getAllExpenses', getExpenses);

// Route for getting expense by ID
router.get('/getExpenseById/:expense_id', getExpenseById);

// Route for updating expense
router.put('/updateExpense/:expense_id', updateExpense);

// Route for deleting expense
router.delete('/deleteExpense/:expense_id', deleteExpense);

module.exports = router;
