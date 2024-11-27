const db = require("../config/db");
const cron = require("node-cron");

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
  const {
    expense_category,
    expense_amount,
    expense_type,
    approval_status,
    user_id,
    store_id,
  } = req.body;

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

const addDailyTransferExpenses = async () => {
  const connection = await db.getConnection();
  const currentDate = new Date().toISOString().slice(0, 10); // Format as 'YYYY-MM-DD'

  try {
    // Start a transaction
    await connection.beginTransaction();

    // Query to get unique `transfer_from` store names with transfers today
    const [transfers] = await connection.query(
      `SELECT DISTINCT transfer_from AS store_name
         FROM transfer
         WHERE DATE(transfer_date) = ?`,
      [currentDate]
    );

    // If there are no transfers, commit an empty transaction and exit
    if (transfers.length === 0) {
      await connection.commit();
      return;
    }

    // Prepare the query to get store_id based on store_name
    const getStoreIdQuery = `
        SELECT store_id, store_name FROM stores WHERE store_name = ?
      `;

    // Prepare expense insertion query and values
    const insertExpenseQuery = `
        INSERT INTO expense (expense_category, expense_amount, expense_type, approval_status, user_id, store_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

    // Loop through each transfer to get the store_id and insert the expense
    for (const transfer of transfers) {
      const storeName = transfer.store_name;

      // Get the store_id for the current store_name
      const [storeData] = await connection.query(getStoreIdQuery, [storeName]);

      if (storeData.length === 0) {
        console.warn(`Store '${storeName}' not found in the stores table.`);
        continue; // Skip if store is not found
      }

      const storeId = storeData[0].store_id;

      // Prepare the expense values
      const expenseValues = [
        "Transfer Handling Fee", // expense_category
        500, // expense_amount
        "Fixed", // expense_type
        "confirmed", // approval_status
        1, // user_id (if applicable)
        storeId, // store_id from the stores table
      ];

      // Insert the expense for the store
      await connection.query(insertExpenseQuery, expenseValues);
    }

    // Commit the transaction
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    console.error("Error adding daily transfer expenses:", err.message);
  } finally {
    connection.release();
  }
};

// Add a new expense category and amount
const addExpenseCategoryAndAmount = async (req, res) => {
  const { expense_category, expense_amount } = req.body;

  const sql = `INSERT INTO expense (expense_category, expense_amount) VALUES (?, ?)`;
  const values = [expense_category, expense_amount];

  try {
    await db.query(sql, values);
    return res
      .status(201)
      .json({ message: "Expense category and amount added successfully." });
  } catch (err) {
    console.error("Error saving expense category and amount:", err.message);
    return res
      .status(500)
      .json({ message: "Error saving expense category and amount", err });
  }
};

// Get expense categories and amounts
const getExpenseCategoryAndAmount = async (req, res) => {
  const sql = "SELECT expense_category, expense_amount FROM expense";

  try {
    const [rows] = await db.query(sql);
    return res.json(rows);
  } catch (err) {
    console.error(
      "Error fetching expense categories and amounts:",
      err.message
    );
    return res
      .status(500)
      .json({ message: "Error fetching expense categories and amounts", err });
  }
};

// Update an existing expense
const updateExpense = async (req, res) => {
  const expense_id = req.params.expense_id;
  const {
    expense_category,
    expense_amount,
    expense_type,
    approval_status,
    store_id,
  } = req.body;

  const sql = `
        UPDATE expense
        SET expense_category = ?, expense_amount = ?, expense_type = ?, approval_status = ?, store_id = ?
        WHERE expense_id = ?
    `;

  const values = [
    expense_category,
    expense_amount,
    expense_type,
    approval_status,
    store_id,
    expense_id,
  ];

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

const getPendingExpenses = async (req, res) => {
  const { store_id } = req.query; // Extract store_id from query parameters

  const sql = `
      SELECT 
        expense.*, 
        stores.store_name, 
        users.username
      FROM 
        expense
      JOIN 
        stores 
      ON 
        expense.store_id = stores.store_id
      JOIN 
        users 
      ON 
        expense.user_id = users.user_id
      WHERE 
        expense.approval_status = 'pending' `;

  try {
    const [rows] = await db.query(sql); // Use store_id as a parameter
    res.json(rows); // Include store name and user name in the response
  } catch (err) {
    console.error("Error fetching pending expenses:", err.message);
    res.status(500).json({ message: "Error fetching pending expenses" });
  }
};

const approveExpense = async (req, res) => {
  const { request_id } = req.body;
  const sql =
    "UPDATE expense SET approval_status = 'confirmed' WHERE expense_id = ?";

  try {
    const [result] = await db.query(sql, [request_id]);
    if (result.affectedRows > 0) {
      res.json({ message: "Expense approved successfully" });
    } else {
      res
        .status(404)
        .json({ message: "Expense not found or already approved" });
    }
  } catch (err) {
    console.error("Error approving expense:", err.message);
    res.status(500).json({ message: "Error approving expense" });
  }
};

// Schedule addDailySalesToIncome to run at 11 PM every day
cron.schedule("00 23 * * *", () => {
  addDailyTransferExpenses();
});

module.exports = {
  getExpenses,
  getExpenseById,
  addExpense,
  updateExpense,
  deleteExpense,
  addExpenseCategoryAndAmount,
  getExpenseCategoryAndAmount,
  getPendingExpenses,
  approveExpense,
};
