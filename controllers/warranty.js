const db = require("../config/db");


// Get all warranties
const getAllWarranties = async (req, res) => {
    const sql = `
        SELECT * 
        FROM warranties
    `;

    try {
        console.log("Fetching all warranties");
        const [rows] = await db.query(sql);

        if (rows.length === 0) {
            return res.status(404).json({ message: "No warranties found." });
        }

        return res.json(rows); // Return all warranty records
    } catch (err) {
        console.error("Error fetching warranties:", err.message);
        return res.status(500).json({ message: "Error inside server", err });
    }
};

// Get warranty information by warranty ID
const getWarrantyById = async (req, res) => {
    const { warranty_id } = req.params;
    const sql = `
        SELECT * 
        FROM warranties 
        WHERE warranty_id = ?
    `;

    try {
        console.log(`Fetching warranty for ID: ${warranty_id}`);
        const [rows] = await db.query(sql, [warranty_id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "No warranty found with the specified ID." });
        }

        return res.json(rows[0]); // Return warranty details for the given ID
    } catch (err) {
        console.error("Error fetching warranty by ID:", err.message);
        return res.status(500).json({ message: "Error inside server", err });
    }
};

// Get warranty information by product ID
const getWarrantyByProductId = async (req, res) => {
    const { product_id } = req.params;
    const sql = `
        SELECT * 
        FROM warranties 
        WHERE product_id = ?
    `;

    try {
        console.log(`Fetching warranty for product ID: ${product_id}`);
        const [rows] = await db.query(sql, [product_id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "No warranty found for the specified product." });
        }

        return res.json(rows); // Return warranty details for the product
    } catch (err) {
        console.error("Error fetching warranty by product ID:", err.message);
        return res.status(500).json({ message: "Error inside server", err });
    }
};

// Get warranty information by sale ID
const getWarrantyBySaleId = async (req, res) => {
    const { sale_id } = req.params;
    const sql = `
        SELECT * 
        FROM warranties 
        WHERE sale_id = ?
    `;

    
    try {
        console.log(`Fetching warranty for sale ID: ${sale_id}`);
        const [rows] = await db.query(sql, [sale_id]);

        console.log("Query result:", rows);
        console.log("Retrieved rows:", JSON.stringify(rows, null, 2)); // Pretty print the fetched rows

        if (rows.length === 0) {
            return res.status(404).json({ message: "No warranty found for the specified sale." });
        }

        return res.json(rows); 
    } catch (err) {
        console.error("Error fetching warranty by sale ID:", err.message);
        return res.status(500).json({ message: "Error inside server", err });
    }
};

// Add warranty for a product
const addWarranty = async (req, res) => {
    const sql = `
        INSERT INTO warranties (product_id, sale_id, warranty_start_date, warranty_end_date,period)
        VALUES (?, ?, ?, ?, ?)
    `;

    const values = [
        req.body.product_id,
        req.body.sale_id,
        req.body.warranty_start_date,
        req.body.warranty_end_date,
        req.body.period,
    ];

    try {
        const [result] = await db.query(sql, values);
        return res.status(200).json({ message: "Warranty added successfully.", result });
    } catch (err) {
        console.error("Error adding warranty:", err.message);
        return res.status(500).json({ message: "Error inside server.", err });
    }
};

// Update warranty information
const updateWarranty = async (req, res) => {
    const { warranty_id } = req.params;
    const sql = `
        UPDATE warranties 
        SET product_id = ?, sale_id = ?, warranty_start_date = ?, warranty_end_date = ?, period = ?
        WHERE warranty_id = ?
    `;

    const values = [
        req.body.product_id,
        req.body.sale_id,
        req.body.warranty_start_date,
        req.body.warranty_end_date,
        req.body.period,
        warranty_id,
    ];

    try {
        const [result] = await db.query(sql, values);
        return res.status(200).json({ message: "Warranty updated successfully.", result });
    } catch (err) {
        console.error("Error updating warranty:", err.message);
        return res.status(500).json({ message: "Error inside server.", err });
    }
};

// Delete warranty
const deleteWarranty = async (req, res) => {
    const { warranty_id } = req.params;
    const sql = "DELETE FROM warranties WHERE warranty_id = ?";

    try {
        console.log(`Deleting warranty with ID: ${warranty_id}`);
        const [result] = await db.query(sql, [warranty_id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Warranty not found." });
        }

        return res.json({ message: "Warranty deleted successfully.", result });
    } catch (err) {
        console.error("Error deleting warranty:", err.message);
        return res.status(500).json({ message: "Error inside server.", err });
    }
};

// Get all warranties for a specific sale and include them on the receipt
const getWarrantiesForReceipt = async (req, res) => {
    const { sale_id } = req.params;
    const sql = `
        SELECT p.product_name, w.warranty_start_date, w.warranty_end_date 
        FROM warranties w
        JOIN products p ON w.product_id = p.product_id
        WHERE w.sale_id = ?
    `;

    try {
        console.log(`Fetching warranties for sale ID: ${sale_id}`);
        const [rows] = await db.query(sql, [sale_id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "No warranties found for the specified sale." });
        }

        return res.json(rows); // Return warranty information to include on the receipt
    } catch (err) {
        console.error("Error fetching warranties for receipt:", err.message);
        return res.status(500).json({ message: "Error inside server", err });
    }
};

module.exports = {
    getAllWarranties,
    getWarrantyById,
    getWarrantyByProductId,
    getWarrantyBySaleId,
    addWarranty,
    updateWarranty,
    deleteWarranty,
    getWarrantiesForReceipt,
};
