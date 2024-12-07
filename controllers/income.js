const db = require("../config/db");
const cron = require("node-cron");

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

const getIncomeCategoryAndAmount = async (req, res) => {
  const sql = "SELECT income_category, income_amount FROM income";

  try {
    const [rows] = await db.query(sql);
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching income categories and amounts:", err.message);
    return res
      .status(500)
      .json({ message: "Error fetching income categories and amounts", err });
  }
};

const addIncomeCategoryAndAmount = async (req, res) => {
  const { income_category, income_amount } = req.body; // Extracting data from the request body

  // SQL query to insert a new income category and amount
  const sql = `INSERT INTO income (income_category, income_amount)
                 VALUES (?, ?)`;

  const values = [income_category, income_amount];

  try {
    await db.query(sql, values);
    return res
      .status(201)
      .json({ message: "Income category and amount added successfully." });
  } catch (err) {
    console.error("Error saving income category and amount:", err.message);
    return res
      .status(500)
      .json({ message: "Error saving income category and amount", err });
  }
};

const addIncome = async (req, res) => {
  const {
    income_category,
    income_amount,
    income_type,
    approval_status,
    user_id,
    store_id,
  } = req.body; // user_id and store_id should be sent in the request body

  // Adjusted SQL query to match the table schema
  const sql = `INSERT INTO income (income_category, income_amount, income_type, approval_status, user_id, store_id)
                 VALUES (?, ?, ?, ?, ?, ?)`;

  const values = [
    income_category,
    income_amount,
    income_type, // Income type
    approval_status, // Approval status
    user_id, // User ID
    store_id, // Store ID
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
  const {
    income_category,
    income_amount,
    income_type,
    approval_status,
    store_id,
  } = req.body;

  const sql = `
        UPDATE income
        SET income_category = ?, income_amount = ?, income_type = ?, approval_status = ?, store_id = ?
        WHERE income_id = ?
    `;

  const values = [
    income_category,
    income_amount,
    income_type,
    approval_status,
    store_id,
    income_id,
  ];

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

const getPendingIncomes = async (req, res) => {
  const { store_id } = req.query; // Extract store_id from query parameters

  const sql = `
      SELECT 
        income.*, 
        stores.store_name, 
        users.username
      FROM 
        income 
      JOIN 
        stores 
      ON 
        income.store_id = stores.store_id
      JOIN 
        users 
      ON 
        income.user_id = users.user_id
      WHERE 
        income.approval_status = 'pending' `;

  try {
    const [rows] = await db.query(sql); // Use store_id as a parameter
    res.json(rows); // Include store name and user name in the response
  } catch (err) {
    console.error("Error fetching pending incomes:", err.message);
    res.status(500).json({ message: "Error fetching pending incomes" });
  }
};

const approveIncome = async (req, res) => {
  const { request_id } = req.body;
  const sql =
    "UPDATE income SET approval_status = 'confirmed' WHERE income_id = ?";

  try {
    const [result] = await db.query(sql, [request_id]);
    if (result.affectedRows > 0) {
      res.json({ message: "Income approved successfully" });
    } else {
      res.status(404).json({ message: "Income not found or already approved" });
    }
  } catch (err) {
    console.error("Error approving income:", err.message);
    res.status(500).json({ message: "Error approving income" });
  }
};

const addDailySalesToIncome = async () => {
  const salesQuery = `
      SELECT 
        c.store_id,
        c.cashier_id,
        SUM(s.total_amount) AS total_sales
      FROM 
        sales s
      JOIN 
        cashiers c ON s.sales_person = c.cashier_name
      WHERE 
        DATE(s.sale_date) = CURDATE()  -- Filter for today's sales by date only, ignoring time
      GROUP BY 
        c.store_id, c.cashier_id -- Include cashier_id in GROUP BY to comply with ONLY_FULL_GROUP_BY
    `;

  try {
    // Fetch total sales for each store and cashier
    const [salesData] = await db.query(salesQuery);

    if (salesData.length === 0) {
      return;
    }

    // Insert daily sales data into income table
    const incomeInsertQuery = `
        INSERT INTO income (income_category, income_type, user_id, income_amount, approval_status, store_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'confirmed', ?, NOW(), NOW())
      `;

    for (const sale of salesData) {
      await db.query(incomeInsertQuery, [
        "Daily Sales", // income_category
        "Sales Revenue", // income_type
        sale.cashier_id, // user_id (assuming cashier_id maps to user_id)
        sale.total_sales, // income_amount
        sale.store_id, // store_id
      ]);
    }
  } catch (err) {
    console.error("Error adding daily sales to income table:", err.message);
  }
};


// Schedule addDailySalesToIncome to run at 11 PM every day
cron.schedule("00 23 * * *", () => {
  addDailySalesToIncome();
});

module.exports = {
  getIncomes,
  getIncomeById,
  getIncomeCategoryAndAmount,
  addIncomeCategoryAndAmount,
  addIncome,
  updateIncome,
  deleteIncome,
  getPendingIncomes,
  approveIncome,
};
