const db = require("../config/db");
const { updateStockAndIMEI } = require("./product"); // Adjust the path as necessary

const addInStockProductToReturn = async (req, res) => {
  const {
    product_id,
    store_name,
    store_id,
    in_imei_number,
    price,
    description,
    user_id,
  } = req.body;
  console.log(req.body);
  const imei_number = in_imei_number;
  const imeiNumbers = imei_number
    ? imei_number.split(",").map((num) => num.trim())
    : [];

  try {
    // Step 1: Check if the product exists in the stock table
    const [stockRows] = await db.query(
      `SELECT stock_quantity, imei_numbers FROM stock WHERE product_id = ? AND store_name = ?`,
      [product_id, store_name]
    );

    if (stockRows.length === 0) {
      return res.status(404).json({
        message: "Product not found in the specified store.",
      });
    }

    const { stock_quantity, imei_numbers: stockIMEIs } = stockRows[0];
    const currentStockIMEIs = stockIMEIs ? stockIMEIs.split(",") : [];

    // Step 2: Check the product type in the products table
    const [productRows] = await db.query(
      `SELECT product_type, product_stock, imei_number FROM products WHERE product_id = ?`,
      [product_id]
    );

    if (productRows.length === 0) {
      return res.status(404).json({ message: "Product not found." });
    }

    const {
      product_type,
      product_stock,
      imei_number: productIMEIs,
    } = productRows[0];
    const currentProductIMEIs = productIMEIs ? productIMEIs.split(",") : [];

    if (product_type === "Mobile Phone") {
      // Step 3: Validate IMEIs for Mobile Phone
      const invalidIMEIs = imeiNumbers.filter(
        (imei) => !currentStockIMEIs.includes(imei)
      );
      if (invalidIMEIs.length > 0) {
        return res.status(400).json({
          message: "Some IMEI numbers are not available in the store's stock.",
          invalidIMEIs,
        });
      }

      // Step 4: Update the stock table
      const updatedStockIMEIs = currentStockIMEIs.filter(
        (imei) => !imeiNumbers.includes(imei)
      );
      const newStockQuantity = stock_quantity - imeiNumbers.length;

      await db.query(
        `UPDATE stock SET imei_numbers = ?, stock_quantity = ?, updated_at = NOW() WHERE product_id = ? AND store_name = ?`,
        [updatedStockIMEIs.join(","), newStockQuantity, product_id, store_name]
      );

      // Step 5: Update the products table
      const updatedProductIMEIs = currentProductIMEIs.filter(
        (imei) => !imeiNumbers.includes(imei)
      );
      const newProductStock = product_stock - imeiNumbers.length;

      await db.query(
        `DELETE FROM products WHERE product_id = ? AND product_stock <= 0`,
        [product_id]
      );

      // If stock still exists, update IMEI numbers
      if (newProductStock > 0) {
        await db.query(
          `UPDATE products SET imei_number = ?, product_stock = ?, updated_at = NOW() WHERE product_id = ?`,
          [updatedProductIMEIs.join(","), newProductStock, product_id]
        );
      }
    } else {
      // Step 6: Handle Non-Mobile Phone Products
      if (1 > stock_quantity) {
        return res.status(400).json({
          message: "Insufficient stock for the specified qty.",
        });
      }

      const newStockQuantity = stock_quantity - 1;
      const newProductStock = product_stock - 1;

      // Update stock table
      await db.query(
        `UPDATE stock SET stock_quantity = ?, updated_at = NOW() WHERE product_id = ? AND store_name = ?`,
        [newStockQuantity, product_id, store_name]
      );

      // Update products table
      await db.query(
        `UPDATE products SET product_stock = ?, updated_at = NOW() WHERE product_id = ?`,
        [newProductStock, product_id]
      );
    }

    // Step 7: Add the product to the return table
    await db.query(
      `INSERT INTO product_return (user_id, store_id, product_id, amount, status, description, imei_number, in_stock, created_at, updated_at)
       VALUES (?, ?, ?, ?, "pending", ?, ?, TRUE, NOW(), NOW())`,
      [user_id, store_id, product_id, price, description, imei_number]
    );

    return res.status(200).json({
      message: "Product return added successfully.",
    });
  } catch (err) {
    console.error("Error processing return:", err.message);
    return res.status(500).json({
      message: "An error occurred during the product return.",
      error: err.message,
    });
  }
};

const addReturnProduct = async (req, res) => {
  const { imei_number, amount, description, user_id, store_id } = req.body;

  try {
    // Step 1: Check if the product with the given imei_number is already in return with 'pending' status
    const checkReturnQuery = `
      SELECT * 
      FROM product_return 
      WHERE imei_number = ? AND status = 'pending'
    `;
    const [existingReturn] = await db.query(checkReturnQuery, [imei_number]);

    if (existingReturn.length > 0) {
      return res
        .status(400)
        .json({
          message: "Product is already in return with a pending status.",
        });
    }

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

    const insertExpenseQuery = `
    INSERT INTO expense (expense_category, expense_type, expense_amount, approval_status, user_id, store_id, created_at, updated_at) 
    VALUES ('Return Product', 'Refund', ?, 'confirmed', ?, ?, NOW(), NOW());
  `;

    // Insert into expense table
    await db.query(insertExpenseQuery, [amount, user_id, store_id]);

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
        SET  imei_number = ''
        WHERE imei_number = ?
      `;

    await db.query(updateSalesItemQuery, [imei_number]);

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

const processinStockReturnToStock = async (req, res) => {
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
    console.log(returnDetails[0]);

    const product_categoryQury = `
      SELECT product_type
      FROM products
      WHERE product_id = ?
    `;

    const [categoryResult] = await db.query(product_categoryQury, [product_id]);

    // Check if a category was found
    if (!categoryResult || categoryResult.length === 0) {
      return res
        .status(404)
        .json({ message: "Category not found for the product." });
    }

    // Extract the `product_type` value (e.g., 'Mobile Phone')
    const productCategory = categoryResult[0].product_type;
    try {
      // Call updateStockAndIMEI from product.js
      const stockUpdateReq = {
        params: { product_id },
        body: {
          product_stock: 1,
          imei_number: [imei_number],
          user,
          category: productCategory,
        },
      };

      await updateStockAndIMEI(stockUpdateReq, res);
    } catch (err) {
      // Handle specific error if updateStockAndIMEI fails
      return res
        .status(500)
        .json({ message: "Error updating stock and IMEI." });
    }
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

const confirmInStockReturn = async (req, res) => {
  const { return_id } = req.body;

  try {
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
        SET  imei_number = ''
        WHERE imei_number = ?
      `;
    await db.query(updateSalesItemQuery, [imei_number]);

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
        SELECT
        stock_status,
        return_id,
        description,
        user_id,
        store_id,
        product_id,
        product_name,
        amount,
        imei_number,
        status,
        created_at,
        updated_at
      FROM (
        SELECT
          CASE
            WHEN pending.in_stock = TRUE THEN 'In Stock'
            ELSE 'Not In Stock'
          END AS stock_status,
          pending.return_id, pending.description, pending.user_id, pending.store_id,
          pending.product_id, p.product_name, pending.amount, pending.imei_number,
          pending.status, pending.created_at, pending.updated_at
        FROM (
          SELECT * 
          FROM product_return 
          WHERE status = 'pending' ${store_id ? "AND store_id = ?" : ""}
          ORDER BY created_at DESC LIMIT 5
        ) AS pending
        LEFT JOIN products p ON pending.product_id = p.product_id

        UNION ALL

        SELECT 
          'Confirmed' AS stock_status,
          confirmed.return_id, confirmed.description, confirmed.user_id, confirmed.store_id,
          confirmed.product_id, p.product_name, confirmed.amount, confirmed.imei_number,
          confirmed.status, confirmed.created_at, confirmed.updated_at
        FROM (
          SELECT * 
          FROM product_return 
          WHERE status = 'confirmed' ${store_id ? "AND store_id = ?" : ""}
          ORDER BY created_at DESC LIMIT 5
        ) AS confirmed
        LEFT JOIN products p ON confirmed.product_id = p.product_id

        UNION ALL

        SELECT 
          'Stock' AS stock_status,
          stock.return_id, stock.description, stock.user_id, stock.store_id,
          stock.product_id, p.product_name, stock.amount, stock.imei_number,
          stock.status, stock.created_at, stock.updated_at
        FROM (
          SELECT * 
          FROM product_return 
          WHERE status = 'stock' ${store_id ? "AND store_id = ?" : ""}
          ORDER BY created_at DESC LIMIT 5
        ) AS stock
        LEFT JOIN products p ON stock.product_id = p.product_id
      ) AS combined_results
      ORDER BY stock_status ASC, created_at DESC;
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
      SET imei_number = ''
      WHERE imei_number = ?
    `;
    await db.query(updateSalesItemQuery, [imei_number]);

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

const inStockReturnToStockWithNewExpense = async (req, res) => {
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
    const product_categoryQury = `
    SELECT product_type
    FROM products
    WHERE product_id = ?
  `;

    const [categoryResult] = await db.query(product_categoryQury, [product_id]);

    // Check if a category was found
    if (!categoryResult || categoryResult.length === 0) {
      return res
        .status(404)
        .json({ message: "Category not found for the product." });
    }

    // Extract the `product_type` value (e.g., 'Mobile Phone')
    const productCategory = categoryResult[0].product_type;
    try {
      const stockUpdateReq = {
        params: { product_id },
        body: {
          product_stock: 1,
          imei_number: [imei_number],
          user,
          category: productCategory,
        },
      };

      await updateStockAndIMEI(stockUpdateReq, res);
    } catch (err) {
      return res
        .status(500)
        .json({ message: "Error updating stock and IMEI.", err });
    }

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
  addInStockProductToReturn,
  processinStockReturnToStock,
  confirmInStockReturn,
  inStockReturnToStockWithNewExpense,
};
