const db = require("../config/db");

// Get all expenses
const getExpenses = async (req, res) => {
    const sql = "SELECT * FROM expense";

    try {
        const [rows] = await db.query(sql);
        return res.json(rows);
    } catch (err) {
        console.error("Error fetching expenses:", err.message);
        return res.status(500).json({ message: "Error fetching expenses", err });
    }
};

// Get a specific expense by ID
const getExpenseById = async (req, res) => {
    const expense_id = req.params.expense_id;

    const sql = "SELECT * FROM expense WHERE expense_id = ?";

    try {
        const [rows] = await db.query(sql, [expense_id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "Expense not found." });
        }

        return res.json(rows[0]);
    } catch (err) {
        console.error("Error fetching expense:", err.message);
        return res.status(500).json({ message: "Error fetching expense", err });
    }
};

// Add a new expense
const addExpense = async (req, res) => {
    const { expense_category, expense_amount, expense_type, approval_status, user_id, store_id } = req.body;

    const sql = `INSERT INTO expense (expense_category, expense_amount, expense_type, approval_status, user_id, store_id)
                 VALUES (?, ?, ?, ?, ?, ?)`;

    const values = [
        expense_category,
        expense_amount,
        expense_type,
        approval_status,
        user_id,
        store_id,
    ];

    try {
        await db.query(sql, values);
        return res.status(201).json({ message: "Expense saved successfully." });
    } catch (err) {
        console.error("Error saving expense:", err.message);
        return res.status(500).json({ message: "Error saving expense", err });
    }
};

// Update an existing expense
const updateExpense = async (req, res) => {
    const expense_id = req.params.expense_id;
    const { expense_category, expense_amount, expense_type, approval_status, store_id } = req.body;

    const sql = `
        UPDATE expense
        SET expense_category = ?, expense_amount = ?, expense_type = ?, approval_status = ?, store_id = ?
        WHERE expense_id = ?
    `;

    const values = [expense_category, expense_amount, expense_type, approval_status, store_id, expense_id];

    try {
        const [result] = await db.query(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Expense not found." });
        }

        return res.json({ message: "Expense updated successfully." });
    } catch (err) {
        console.error("Error updating expense:", err.message);
        return res.status(500).json({ message: "Error updating expense", err });
    }
};

// Delete an expense
const deleteExpense = async (req, res) => {
    const expense_id = req.params.expense_id;

    const sql = "DELETE FROM expense WHERE expense_id = ?";

    try {
        const [result] = await db.query(sql, [expense_id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Expense not found." });
        }

        return res.json({ message: "Expense deleted successfully." });
    } catch (err) {
        console.error("Error deleting expense:", err.message);
        return res.status(500).json({ message: "Error deleting expense", err });
    }
};

module.exports = {
    getExpenses,
    getExpenseById,
    addExpense,
    updateExpense,
    deleteExpense,
};
