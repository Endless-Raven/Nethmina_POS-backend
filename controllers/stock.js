const db = require("../config/db");

const manageStock = async (req, res) => {
    console.log("Request body", req.body);
  
    const { product_id, stock_quantity, main_branch, target_branch, imei_numbers } = req.body;
  
    // Start a transaction
    const connection = await db.getConnection(); // Get a connection from the pool
    await connection.beginTransaction(); // Start the transaction
  
    try {
      // Check if the product exists in the target branch
      const checkProductQuery = `
        SELECT * FROM stock
        WHERE product_id = ? AND store_name = ?;
      `;
      const [rows] = await connection.query(checkProductQuery, [product_id, target_branch]);
  
      if (rows.length > 0) {
        // Product exists in the target branch, update stock
        const updateStockQuery = `
          UPDATE stock
          SET stock_quantity = stock_quantity + ?, updated_at = NOW(), imei_numbers = CONCAT(imei_numbers, ?, ',')
          WHERE product_id = ? AND store_name = ?;
        `;
        await connection.query(updateStockQuery, [stock_quantity, imei_numbers.join(','), product_id, target_branch]);
      } else {
        // Product doesn't exist in the target branch, create a new row
        const insertStockQuery = `
          INSERT INTO stock (store_name, product_id, stock_quantity, created_at, updated_at, imei_numbers)
          VALUES (?, ?, ?, NOW(), NOW(), ?);
        `;
        await connection.query(insertStockQuery, [target_branch, product_id, stock_quantity, imei_numbers.join(',')]);
      }
  
      // Now reduce the stock from the main branch
      const reduceMainStockQuery = `
        UPDATE stock
        SET stock_quantity = stock_quantity - ?, updated_at = NOW(), imei_numbers = REPLACE(imei_numbers, ?, '')
        WHERE product_id = ? AND store_name = ? AND stock_quantity >= ?;
      `;
      const [mainStockUpdated] = await connection.query(reduceMainStockQuery, [stock_quantity, imei_numbers.join(','), product_id, main_branch, stock_quantity]);
  
      if (mainStockUpdated.affectedRows === 0) {
        // Rollback transaction if there's insufficient stock or product not found
        await connection.rollback();
        return res.status(400).json({ message: "Insufficient stock in the main branch or product not found." });
      }
  
      // Commit the transaction
      await connection.commit();
  
      return res.status(200).json({ message: "Stock transferred successfully." });
    } catch (err) {
      // Rollback transaction on error
      await connection.rollback();
      console.error("Error processing stock transfer:", err.message);
      return res.status(500).json({ message: "Error inside server during stock transfer.", err });
    } finally {
      // Release the connection back to the pool
      connection.release();
    }
  };




  const getStockByProductAndStore = async (req, res) => {
   
  
    const { product_name, store_name } = req.body;
  
    try {
      // Fetch the product_id from the products table based on product_name
      const getProductIdQuery = `
        SELECT product_id FROM products
        WHERE product_name = ?;
      `;
      const [productRows] = await db.query(getProductIdQuery, [product_name]);

      if (productRows.length === 0) { 
         console.log("Request body", req.body ,productRows );
        return res.status(404).json({ message: "Product not found." });
      }

      const product_id = productRows[0].product_id;
     
      // Fetch stock details based on store_name and product_id
      const getStockDetailsQuery = `
        SELECT * FROM stock
        WHERE product_id = ? AND store_name = ?;
      `;
      const [stockRows] = await db.query(getStockDetailsQuery, [product_id, store_name]);

      if (stockRows.length === 0) {
        return res.status(404).json({ message: "No stock found for this product in the specified store." });
      }

      // Return the stock details
      return res.status(200).json(stockRows[0]);

    } catch (err) {
      console.error("Error fetching stock details:", err.message);
      return res.status(500).json({ message: "Error inside server during fetching stock details.", err });
    }
};



  
  
  


  module.exports = {
    manageStock,
    getStockByProductAndStore


  };