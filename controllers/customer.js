const db = require("../config/db");

// Get all customers
const getCustomers = async (req, res) => {
    const sql = "SELECT * FROM customers";
    
    try {
        console.log("Fetching all customers");
        const [rows] = await db.query(sql);
        return res.json(rows);
    } catch (err) {
        console.error("Error fetching customers:", err.message);
        return res.status(500).json({ message: "Error inside server", err });
    }
};

// Get customer by ID
const getCustomerById = async (req, res) => {
    const { id } = req.params; // Get customer ID from request parameters
    const sql = "SELECT * FROM customers WHERE customer_id = ?";

    try {
        console.log(`Fetching customer with ID: ${id}`);
        const [rows] = await db.query(sql, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "Customer not found." });
        }

        return res.json(rows[0]); // Return the first customer (should be only one with the ID)
    } catch (err) {
        console.error("Error fetching customer by ID:", err.message);
        return res.status(500).json({ message: "Error inside server", err });
    }
};

// Get customer by email
const getCustomerByEmail = async (req, res) => {
    const { email } = req.params; // Get email from request parameters
    const sql = "SELECT * FROM customers WHERE customer_email = ?";

    try {
        console.log(`Fetching customer with email: ${email}`);
        const [rows] = await db.query(sql, [email]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "Customer not found." });
        }

        return res.json(rows); // Return all customers with the specified email
    } catch (err) {
        console.error("Error fetching customer by email:", err.message);
        return res.status(500).json({ message: "Error inside server", err });
    }
};

// Get customer by phone number
const getCustomerByPhoneNumber = async (req, res) => {
    const { phone_number } = req.params; // Get phone number from request parameters
    const sql = "SELECT * FROM customers WHERE customer_phone_number = ?";
  
    try {
        console.log(`Fetching customer with phone number: ${phone_number}`);
        const [rows] = await db.query(sql, [phone_number]);
  
        if (rows.length === 0) {
            return res.status(404).json({ message: "Customer not found." });
        }
  
        return res.json(rows); // Return the customer details found by phone number
    } catch (err) {
        console.error("Error fetching customer by phone number:", err.message);
        return res.status(500).json({ message: "Error inside server", err });
    }
};


// Add customer
const addCustomer = async (req, res) => {
    const sql = `
    INSERT INTO customers (customer_name, customer_email, customer_phone_number, customer_address)
    VALUES (?, ?, ?, ?)
  `;

    const values = [
        req.body.customer_name,
        req.body.customer_email,
        req.body.customer_phone_number,
        req.body.customer_address,
    ];

    try {
        const [result] = await db.query(sql, values);
        return res.status(200).json({ message: "Customer added successfully.", result });
    } catch (err) {
        console.error("Error adding customer:", err.message);
        return res.status(500).json({ message: "Error inside server.", err });
    }
};

// Update customer
const updateCustomer = async (req, res) => {
    const sql = `
      UPDATE customers 
      SET customer_name = ?, customer_email = ?, customer_phone_number = ?, customer_address = ?
      WHERE customer_id = ?
    `;

    const customerId = req.params.customer_id;

    const values = [
        req.body.customer_name,
        req.body.customer_email,
        req.body.customer_phone_number,
        req.body.customer_address,
        customerId,
    ];

    try {
        const [result] = await db.query(sql, values);
        return res.status(200).json({ message: "Customer updated successfully.", result });
    } catch (err) {
        console.error("Error updating customer:", err.message);
        return res.status(500).json({ message: "Error inside server.", err });
    }
};

// Delete a customer
const deleteCustomer = async (req, res) => {
    const sql = "DELETE FROM customers WHERE customer_id = ?;";
    const value = req.params.customer_id;

    try {
        console.log("Deleting customer");
        const [result] = await db.query(sql, [value]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Customer not found" });
        }
        return res.json({ message: "Customer deleted successfully", result });
    } catch (err) {
        return res.status(500).json({ message: "Error inside server", err });
    }
};

module.exports = {
    getCustomers,
    getCustomerById,
    getCustomerByEmail,
    getCustomerByPhoneNumber,
    addCustomer,
    updateCustomer,
    deleteCustomer,
};
