const express = require("express");

const { addExpense, getExpenses, getExpenseById, addExpenseCategoryAndAmount, getExpenseCategoryAndAmount, updateExpense, deleteExpense,getPendingExpenses,approveExpense } = require("../controllers/expense");

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

// Route for posting new expense category and amount
router.post('/AddExpenseCategory', addExpenseCategoryAndAmount); 

// Route for getting expense categories and amounts
router.get('/getExpenseCategoryAndAmount', getExpenseCategoryAndAmount);



router.get('/getPendingExpenses', getPendingExpenses);


router.post('/approve', approveExpense);

module.exports = router;
