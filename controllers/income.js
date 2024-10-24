const db = require("../config/db");

const getIncomes = async (req, res) => {
    const sql = "SELECT * FROM income";

    try {
        const [rows] = await db.query(sql);
        return res.json(rows);
    } catch (err) {
        console.error("Error fetching incomes:", err.message);
        return res.status(500).json({ message: "Error fetching incomes", err });
    }
};

const getIncomeById = async (req, res) => {
    const income_id = req.params.income_id;

    const sql = "SELECT * FROM income WHERE income_id = ?";

    try {
        const [rows] = await db.query(sql, [income_id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "Income not found." });
        }

        return res.json(rows[0]);
    } catch (err) {
        console.error("Error fetching income:", err.message);
        return res.status(500).json({ message: "Error fetching income", err });
    }
};

const addIncome = async (req, res) => {
    const { income_category, income_amount, income_type,approval_status, user_id, store_id } = req.body; // user_id and store_id should be sent in the request body

    // Adjusted SQL query to match the table schema
    const sql = `INSERT INTO income (income_category, income_amount, income_type, approval_status, user_id, store_id)
                 VALUES (?, ?, ?, ?, ?, ?)`;

    const values = [
        income_category,
        income_amount,
        income_type, // Income type
        approval_status, // Approval status
        user_id,   // User ID
        store_id,  // Store ID

    ];

    try {
        await db.query(sql, values);
        return res.status(201).json({ message: "Income saved successfully." });
    } catch (err) {
        console.error("Error saving income:", err.message);
        return res.status(500).json({ message: "Error saving income", err });
    }
};

const updateIncome = async (req, res) => {
    const income_id = req.params.income_id;
    const { income_category, income_amount, income_type, approval_status, store_id } = req.body;

    const sql = `
        UPDATE income
        SET income_category = ?, income_amount = ?, income_type = ?, approval_status = ?, store_id = ?
        WHERE income_id = ?
    `;

    const values = [income_category, income_amount, income_type, approval_status, store_id, income_id];

    try {
        const [result] = await db.query(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Income not found." });
        }

        return res.json({ message: "Income updated successfully." });
    } catch (err) {
        console.error("Error updating income:", err.message);
        return res.status(500).json({ message: "Error updating income", err });
    }
};


const deleteIncome = async (req, res) => {
    const income_id = req.params.income_id;

    const sql = "DELETE FROM income WHERE income_id = ?";

    try {
        const [result] = await db.query(sql, [income_id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Income not found." });
        }

        return res.json({ message: "Income deleted successfully." });
    } catch (err) {
        console.error("Error deleting income:", err.message);
        return res.status(500).json({ message: "Error deleting income", err });
    }
};

module.exports = {
    getIncomes,
    getIncomeById,
    addIncome,
    updateIncome,
    deleteIncome,
};
