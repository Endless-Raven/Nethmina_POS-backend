const db = require("../config/db");

// Get all cashiers
const getCashiers = async (req, res) => {
    const sql = "SELECT * FROM cashiers";
    
    try {
        console.log("Fetching all cashiers");
        const [rows] = await db.query(sql);
        return res.json(rows);
    } catch (err) {
        console.error("Error fetching cashiers:", err.message);
        return res.status(500).json({ message: "Error inside server", err });
    }
};

// Get cashier by ID
const getCashierById = async (req, res) => {
    const { id } = req.params;
    const sql = "SELECT * FROM cashiers WHERE cashier_id = ?";

    try {
        console.log(`Fetching cashier with ID: ${id}`);
        const [rows] = await db.query(sql, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "Cashier not found." });
        }

        return res.json(rows[0]);
    } catch (err) {
        console.error("Error fetching cashier by ID:", err.message);
        return res.status(500).json({ message: "Error inside server", err });
    }
};

// Get cashiers by store name
const getCashiersByStoreName = async (req, res) => {
    const { store_name } = req.params; // Get store name from request parameters
    const sql = `
        SELECT c.* 
        FROM cashiers c
        JOIN stores s ON c.store_id = s.store_id
        WHERE s.store_name = ?
    `;

    try {
        console.log(`Fetching cashiers for store name: ${store_name}`);
        const [rows] = await db.query(sql, [store_name]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "No cashiers found for the specified store." });
        }

        return res.json(rows); // Return all cashiers found for the specified store
    } catch (err) {
        console.error("Error fetching cashiers by store name:", err.message);
        return res.status(500).json({ message: "Error inside server", err });
    }
};

// Get cashier by email
const getCashierByEmail = async (req, res) => {
    const { email } = req.params; // Get email from request parameters
    const sql = "SELECT * FROM cashiers WHERE cashier_email = ?";

    try {
        console.log(`Fetching cashier with email: ${email}`);
        const [rows] = await db.query(sql, [email]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "Cashier not found." });
        }

        return res.json(rows[0]); // Return the first cashier (should be only one with the email)
    } catch (err) {
        console.error("Error fetching cashier by email:", err.message);
        return res.status(500).json({ message: "Error inside server", err });
    }
};

// Get cashier by phone number
const getCashierByPhoneNumber = async (req, res) => {
    const { phone_number } = req.params; // Get phone number from request parameters
    const sql = "SELECT * FROM cashiers WHERE cashier_phone_number = ?";

    try {
        console.log(`Fetching cashier with phone number: ${phone_number}`);
        const [rows] = await db.query(sql, [phone_number]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "Cashier not found." });
        }

        return res.json(rows[0]); // Return the first cashier (should be only one with the phone number)
    } catch (err) {
        console.error("Error fetching cashier by phone number:", err.message);
        return res.status(500).json({ message: "Error inside server", err });
    }
};

// Add cashier
const addCashier = async (req, res) => {
    const sql = `
    INSERT INTO cashiers (cashier_name, cashier_email, cashier_phone_number, store_id)
    VALUES (?, ?, ?, ?)
  `;

    const values = [
        req.body.cashier_name,
        req.body.cashier_email,
        req.body.cashier_phone_number,
        req.body.store_id,
    ];

    try {
        const [result] = await db.query(sql, values);
        return res.status(200).json({ message: "Cashier added successfully.", result });
    } catch (err) {
        console.error("Error adding cashier:", err.message);
        return res.status(500).json({ message: "Error inside server.", err });
    }
};

// Update cashier
const updateCashier = async (req, res) => {
    const sql = `
      UPDATE cashiers 
      SET cashier_name = ?, cashier_email = ?, cashier_phone_number = ?, store_id = ?
      WHERE cashier_id = ?
    `;

    const cashierId = req.params.cashier_id;

    const values = [
        req.body.cashier_name,
        req.body.cashier_email,
        req.body.cashier_phone_number,
        req.body.store_id,
        cashierId,
    ];

    try {
        const [result] = await db.query(sql, values);
        return res.status(200).json({ message: "Cashier updated successfully.", result });
    } catch (err) {
        console.error("Error updating cashier:", err.message);
        return res.status(500).json({ message: "Error inside server.", err });
    }
};

// Delete cashier
const deleteCashier = async (req, res) => {
    const sql = "DELETE FROM cashiers WHERE cashier_id = ?;";
    const value = req.params.cashier_id;

    try {
        console.log("Deleting cashier");
        const [result] = await db.query(sql, [value]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Cashier not found" });
        }
        return res.json({ message: "Cashier deleted successfully", result });
    } catch (err) {
        return res.status(500).json({ message: "Error inside server", err });
    }
};

module.exports = {
    getCashiers,
    getCashierById,
    getCashiersByStoreName,
    getCashierByEmail,
    getCashierByPhoneNumber,
    addCashier,
    updateCashier,
    deleteCashier,
};
