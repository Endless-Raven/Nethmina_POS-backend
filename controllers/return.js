const db = require("../config/db");
const { updateStockAndIMEI } = require("./product"); // Adjust the path as necessary

const addReturnProduct = async (req, res) => {
  const { imei_number, amount, description, user_id, store_id } = req.body;

  try {
    // Step 1: Get sale_id and product_id from sales_items using imei_number
    const salesItemQuery = `
        SELECT sale_id, product_id, item_price
        FROM sales_items
        WHERE imei_number = ?
      `;
    const [salesItem] = await db.query(salesItemQuery, [imei_number]);
    if (salesItem.length === 0) {
      return res
        .status(404)
        .json({ message: "Sale item with the given IMEI number not found." });
    }

    const { sale_id, product_id, item_price } = salesItem[0];

    // Step 2: Insert return details into the return table
    const insertReturnQuery = `
        INSERT INTO product_return (user_id,store_id,product_id, amount, status, description, imei_number, created_at, updated_at)
        VALUES (?,?,?, ?, "pending", ?, ?, NOW(), NOW())
      `;
    await db.query(insertReturnQuery, [
      user_id,
      store_id,
      product_id,
      amount,
      description,
      imei_number,
    ]);

    return res
      .status(200)
      .json({ message: "Return product request added successfully." });
  } catch (err) {
    console.error("Error adding return product:", err.message);
    return res
      .status(500)
      .json({ message: "Error adding return product.", err });
  }
};

const processReturnToStock = async (req, res) => {
  const { return_id, user } = req.body;

  try {
    const returnQuery = `
        SELECT user_id, store_id,  product_id, amount, imei_number
        FROM product_return
        WHERE return_id = ?
      `;

    const [returnDetails] = await db.query(returnQuery, [return_id]);
    if (returnDetails.length === 0) {
      return res.status(404).json({ message: "Return request not found." });
    }

    const { user_id, store_id, product_id, amount, imei_number } =
      returnDetails[0];

    const salesItemQuery = `
        SELECT sale_id
        FROM sales_items
        WHERE imei_number = ?
      `;
    const [salesItem] = await db.query(salesItemQuery, [imei_number]);
    if (salesItem.length === 0) {
      return res
        .status(404)
        .json({ message: "Sale item not found for the given IMEI number." });
    }

    const { sale_id } = salesItem[0];
    try {
      // Call updateStockAndIMEI from product.js
      const stockUpdateReq = {
        params: { product_id },
        body: {
          product_stock: 1,
          imei_number: [imei_number],
          user,
          category: "Mobile Phone",
        },
      };

      await updateStockAndIMEI(stockUpdateReq, res);
    } catch (err) {
      // Handle specific error if updateStockAndIMEI fails
      return res
        .status(500)
        .json({ message: "Error updating stock and IMEI." });
    }

    const updateSalesItemQuery = `
        UPDATE sales_items
        SET item_price = item_price - ?, imei_number = ''
        WHERE imei_number = ?
      `;

    const insertExpenseQuery = `
      INSERT INTO expense (expense_category, expense_type, expense_amount, approval_status, user_id, store_id, created_at, updated_at) 
      VALUES ('Return Product', 'Refund', ?, 'confirmed', ?, ?, NOW(), NOW());
    `;

    await db.query(updateSalesItemQuery, [amount, imei_number]);
    // Insert into expense table
    await db.query(insertExpenseQuery, [amount, user_id, store_id]);

    const updateSalesQuery = `
        UPDATE sales 
        SET total_amount = total_amount - ? 
        WHERE sale_id = ?;
      `;
    await db.query(updateSalesQuery, [amount, sale_id]);

    const updateReturnQuery = `
        UPDATE product_return
        SET status = 'stock', updated_at = NOW()
        WHERE return_id = ?
      `;
    await db.query(updateReturnQuery, [return_id]);
  } catch (err) {
    console.error("Error processing return to stock:", err.message);
    // Make sure only one response is sent even in case of errors
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ message: "Error processing return to stock.", err });
    }
  }
};

const confirmReturn = async (req, res) => {
  const { return_id } = req.body;

  try {
    const returnQuery = `
        SELECT  user_id, store_id, product_id, amount, imei_number
        FROM product_return
        WHERE return_id = ?
      `;
    const [returnDetails] = await db.query(returnQuery, [return_id]);
    if (returnDetails.length === 0) {
      return res.status(404).json({ message: "Return request not found." });
    }

    const { user_id, store_id, product_id, amount, imei_number } =
      returnDetails[0];

    const salesItemQuery = `
        SELECT sale_id
        FROM sales_items
        WHERE imei_number = ?
      `;
    const [salesItem] = await db.query(salesItemQuery, [imei_number]);
    if (salesItem.length === 0) {
      return res
        .status(404)
        .json({ message: "Sale item not found for the given IMEI number." });
    }

    const { sale_id } = salesItem[0];

    const updateSalesItemQuery = `
        UPDATE sales_items
        SET item_price = item_price - ?, imei_number = ''
        WHERE imei_number = ?
      `;
    await db.query(updateSalesItemQuery, [amount, imei_number]);

    const insertExpenseQuery = `
      INSERT INTO expense (expense_category, expense_type, expense_amount, approval_status, user_id, store_id, created_at, updated_at) 
      VALUES ('Return Product', 'Refund', ?, 'confirmed', ?, ?, NOW(), NOW());
    `;
    // Insert into expense table
    await db.query(insertExpenseQuery, [amount, user_id, store_id]);

    const updateSalesQuery = `
        UPDATE sales 
        SET total_amount = total_amount - ? 
        WHERE sale_id = ?;
      `;
    await db.query(updateSalesQuery, [amount, sale_id]);

    const updateReturnQuery = `
        UPDATE product_return
        SET status = 'confirmed', updated_at = NOW()
        WHERE return_id = ?
      `;
    await db.query(updateReturnQuery, [return_id]);

    return res
      .status(200)
      .json({ message: "Return request confirmed successfully." });
  } catch (err) {
    console.error("Error confirming return request:", err.message);
    return res
      .status(500)
      .json({ message: "Error confirming return request.", err });
  }
};

const getReturns = async (req, res) => {
  try {
    const { store_id } = req.query; // Optionally filter by store_id

    // SQL query to fetch the latest 5 records for each status
    const returnQuery = `
      SELECT pending.return_id, pending.description , pending.user_id, pending.store_id, pending.product_id, p.product_name, pending.amount, pending.imei_number, pending.status, pending.created_at, pending.updated_at
      FROM (
        SELECT * FROM product_return WHERE status = 'pending' ${
          store_id ? "AND store_id = ?" : ""
        }
        ORDER BY created_at DESC LIMIT 5
      ) AS pending
      LEFT JOIN products p ON pending.product_id = p.product_id

      UNION ALL

      SELECT confirmed.return_id, confirmed.description , confirmed.user_id, confirmed.store_id, confirmed.product_id, p.product_name, confirmed.amount, confirmed.imei_number, confirmed.status, confirmed.created_at, confirmed.updated_at
      FROM (
        SELECT * FROM product_return WHERE status = 'confirmed' ${
          store_id ? "AND store_id = ?" : ""
        }
        ORDER BY created_at DESC LIMIT 5
      ) AS confirmed
      LEFT JOIN products p ON confirmed.product_id = p.product_id

      UNION ALL

      SELECT stock.return_id , stock.description , stock.user_id, stock.store_id, stock.product_id, p.product_name, stock.amount, stock.imei_number, stock.status, stock.created_at, stock.updated_at
      FROM (
        SELECT * FROM product_return WHERE status = 'stock' ${
          store_id ? "AND store_id = ?" : ""
        }
        ORDER BY created_at DESC LIMIT 5
      ) AS stock
      LEFT JOIN products p ON stock.product_id = p.product_id
    `;

    // Parameters for the query
    const queryParams = store_id ? [store_id, store_id, store_id] : [];

    // Execute the query
    const [returns] = await db.query(returnQuery, queryParams);

    // Check if results are found
    if (!returns.length) {
      return res.status(404).json({ message: "No returns found." });
    }

    // Return the list of returns
    return res.status(200).json(returns);
  } catch (err) {
    console.error("Error fetching returns:", err.message);
    return res.status(500).json({ message: "Error fetching returns.", err });
  }
};

const getPendingReturnsCount = async (req, res) => {
  try {
    const { store_id } = req.query; // Optionally filter by store_id

    // SQL query to fetch the count of pending returns
    const countQuery = `
      SELECT COUNT(*) AS count
      FROM product_return
      WHERE status = 'pending' ${store_id ? "AND store_id = ?" : ""}
    `;

    // Parameters for the query
    const queryParams = store_id ? [store_id] : [];

    // Execute the query
    const [result] = await db.query(countQuery, queryParams);

    // Extract the count
    const count = result[0]?.count || 0;

    // Respond with the count
    return res.status(200).json({ count });
  } catch (err) {
    console.error("Error fetching pending returns count:", err.message);
    return res
      .status(500)
      .json({ message: "Error fetching pending returns count.", err });
  }
};

const processReturnToStockWithNewExpense = async (req, res) => {
  const { return_id, user, expense_category, expense_amount, store_id } =
    req.body;

  try {
    // Fetch return details
    const returnQuery = `
      SELECT user_id as userID, store_id, product_id, amount, imei_number
      FROM product_return
      WHERE return_id = ?
    `;
    const [returnDetails] = await db.query(returnQuery, [return_id]);

    if (returnDetails.length === 0) {
      return res.status(404).json({ message: "Return request not found." });
    }

    const { userID, product_id, amount, imei_number } = returnDetails[0];

    const salesItemQuery = `
      SELECT sale_id
      FROM sales_items
      WHERE imei_number = ?
    `;
    const [salesItem] = await db.query(salesItemQuery, [imei_number]);

    if (salesItem.length === 0) {
      return res
        .status(404)
        .json({ message: "Sale item not found for the given IMEI number." });
    }

    const { sale_id } = salesItem[0];

    // Update stock and IMEI details
    try {
      const stockUpdateReq = {
        params: { product_id },
        body: {
          product_stock: 1,
          imei_number: [imei_number],
          user,
          category: "Mobile Phone",
        },
      };

      await updateStockAndIMEI(stockUpdateReq, res);
    } catch (err) {
      return res
        .status(500)
        .json({ message: "Error updating stock and IMEI.", err });
    }

    // Update sales_items table
    const updateSalesItemQuery = `
      UPDATE sales_items
      SET item_price = item_price - ?, imei_number = ''
      WHERE imei_number = ?
    `;
    await db.query(updateSalesItemQuery, [amount, imei_number]);

    // Insert refund into expense table for return
    const insertRefundExpenseQuery = `
      INSERT INTO expense (expense_category, expense_type, expense_amount, approval_status, user_id, store_id, created_at, updated_at)
      VALUES ('Return Product', 'Refund', ?, 'confirmed', ?, ?, NOW(), NOW())
    `;
    await db.query(insertRefundExpenseQuery, [amount, userID, store_id]);

    // Insert new expense with details from frontend
    const insertNewExpenseQuery = `
      INSERT INTO expense (expense_category, expense_type, expense_amount, approval_status, user_id, store_id, created_at, updated_at)
      VALUES (?, 'Other', ?, 'confirmed', ?, ?, NOW(), NOW())
    `;
    await db.query(insertNewExpenseQuery, [
      expense_category,
      expense_amount,
      user,
      store_id,
    ]);

    // Update sales table
    const updateSalesQuery = `
      UPDATE sales 
      SET total_amount = total_amount - ? 
      WHERE sale_id = ?;
    `;
    await db.query(updateSalesQuery, [amount, sale_id]);

    // Update product_return status
    const updateReturnQuery = `
      UPDATE product_return
      SET status = 'stock', updated_at = NOW()
      WHERE return_id = ?
    `;
    await db.query(updateReturnQuery, [return_id]);
  } catch (err) {
    console.error(
      "Error processing return to stock with new expense:",
      err.message
    );

    if (!res.headersSent) {
      return res.status(500).json({
        message: "Error processing return to stock with new expense.",
        err,
      });
    }
  }
};

module.exports = {
  addReturnProduct,
  processReturnToStock,
  confirmReturn,
  getReturns,
  getPendingReturnsCount,
  processReturnToStockWithNewExpense,
};
