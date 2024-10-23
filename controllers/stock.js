const db = require("../config/db");

//manages stock(post request)
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


  //stock by product and store(get)
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

//get  store and product categories
  const getStoresAndCategories = async (req, res) => {
    try {
      // Fetch all shops
      const getStoreQuery = `SELECT store_name FROM stores`;
      const [storesRows] = await db.query(getStoreQuery);
  
      // Fetch all product types (categories)
      const getProductTypesQuery = `SELECT DISTINCT product_type FROM products`;
      const [productTypesRows] = await db.query(getProductTypesQuery);
  
      // Extract the shop names and product types
      const stores = storesRows.map(row => row.store_name);
      const product_types = productTypesRows.map(row => row.product_type);
  
      // Respond with the shops and categories
      return res.status(200).json({
        stores,
        product_types,
      });
    } catch (err) {
      console.error("Error fetching shops and categories:", err.message);
      return res.status(500).json({ message: "Server error while fetching shops and categories." });
    }
  };
  

  //get brands of given category(get)
  const getBrandsByCategory = async (req, res) => {
    const { category } = req.params; // Get category from route parameters
  
    // Check if category is provided
    if (!category) {
      return res.status(400).json({ message: "Category is required." });
    }
  
    try {
      // Fetch distinct brands based on category
      const getBrandsQuery = `
        SELECT DISTINCT brand_name FROM products 
        WHERE product_type = ?; 
      `;
      const [brandsRows] = await db.query(getBrandsQuery, [category]);
  
      // Check if any brands were found
      if (brandsRows.length === 0) {
        return res.status(404).json({ message: "No brands found for this category." });
      }
  
      // Extract the brand names
      const brands = brandsRows.map(row => row.brand_name); // Corrected here
  
      // Return the brands in the response
      return res.status(200).json(brands);
    } catch (err) {
      console.error("Error fetching brands by category:", err.message);
      return res.status(500).json({ message: "Server error while fetching brands." });
    }
  };

  //get product details whne category and brand given(get)
  const getProductsByCategoryAndBrand = async (req, res) => {
    const { product_type, brand_name } = req.query; // Get parameters from query

    // Check if both parameters are provided
    if (!product_type || !brand_name) {
        return res.status(400).json({ message: "Product type and brand name are required." });
    }

    try {
        // Fetch products based on product_type and brand_name
        const getProductsQuery = `
            SELECT p.product_id, p.product_name, s.stock_quantity 
            FROM products p
            JOIN stock s ON p.product_id = s.product_id
            WHERE p.product_type = ? AND p.brand_name = ?;
        `;
        const [productRows] = await db.query(getProductsQuery, [product_type, brand_name]);

        // Check if any products were found
        if (productRows.length === 0) {
            return res.status(404).json({ message: "No products found for this category and brand." });
        }

        // Return the products in the response
        return res.status(200).json(productRows);
    } catch (err) {
        console.error("Error fetching products by category and brand:", err.message);
        return res.status(500).json({ message: "Server error while fetching products." });
    }
};


//transfer
const transferStock = async (req, res) => {
  const { products, from, to } = req.body;

  // Validate request body
  if (!products || products.length === 0 || !from || !to) {
      return res.status(400).json({ message: "Invalid request body. Please provide products, from, and to fields." });
  }

  // Create transfer ID, date, and time
  const transferId = `TRANS-${Date.now()}`;
  const date = new Date().toISOString().split('T')[0]; // yyyy-mm-dd format
  const time = new Date().toISOString().split('T')[1].split('.')[0]; // hh:mm:ss format

  // Start a transaction
  const connection = await db.getConnection(); // Get DB connection
  await connection.beginTransaction();

  try {
      // Insert transfer record into the transfers table
      const createTransferQuery = `
          INSERT INTO transfers (transfer_id, from_store, to_store, date, time, completed) 
          VALUES (?, ?, ?, ?, ?, ?);
      `;
      await connection.query(createTransferQuery, [transferId, from, to, date, time, false]);

      // Iterate over each product and update stock
      for (const product of products) {
          const { product_id, transfer_quantity, imei_number } = product;

          // Validate transfer_quantity
          if (!transfer_quantity || transfer_quantity <= 0) {
              throw new Error(`Invalid transfer quantity for product ID ${product_id}.`);
          }

          // Check if the 'from' store has sufficient stock
          const checkStockQuery = `
              SELECT stock_quantity FROM stock 
              WHERE product_id = ? AND store_name = ?;
          `;
          const [stockRows] = await connection.query(checkStockQuery, [product_id, from]);

          if (stockRows.length === 0 || stockRows[0].stock_quantity < transfer_quantity) {
              throw new Error(`Insufficient stock for product ID ${product_id} in ${from}.`);
          }

          // Reduce stock in the 'from' store
          const reduceStockQuery = `
              UPDATE stock 
              SET stock_quantity = stock_quantity - ? 
              WHERE product_id = ? AND store_name = ?;
          `;
          await connection.query(reduceStockQuery, [transfer_quantity, product_id, from]);

          // Add stock to the 'to' store
          const checkToStockQuery = `
              SELECT stock_quantity FROM stock 
              WHERE product_id = ? AND store_name = ?;
          `;
          const [toStockRows] = await connection.query(checkToStockQuery, [product_id, to]);

          if (toStockRows.length > 0) {
              // Product exists in the 'to' store, update stock
              const updateToStockQuery = `
                  UPDATE stock 
                  SET stock_quantity = stock_quantity + ? 
                  WHERE product_id = ? AND store_name = ?;
              `;
              await connection.query(updateToStockQuery, [transfer_quantity, product_id, to]);
          } else {
              // Product doesn't exist in the 'to' store, create new stock entry
              const insertToStockQuery = `
                  INSERT INTO stock (product_id, store_name, stock_quantity) 
                  VALUES (?, ?, ?);
              `;
              await connection.query(insertToStockQuery, [product_id, to, transfer_quantity]);
          }

          // Handle IMEI numbers if present
          if (imei_number && imei_number.length > 0) {
              const insertImeiQuery = `
                  INSERT INTO imei_numbers (product_id, imei_number, store_name, transfer_id)
                  VALUES (?, ?, ?, ?);
              `;
              for (const imei of imei_number) {
                  await connection.query(insertImeiQuery, [product_id, imei, to, transferId]);
              }
          }
      }

      // Commit the transaction
      await connection.commit();

      // Send response
      return res.status(200).json({
          message: "Stock transfer successful.",
          transfer_id: transferId,
          date,
          time,
          completed: false,
      });
  } catch (err) {
      // Rollback transaction on error
      await connection.rollback();
      console.error("Error during stock transfer:", err.message);
      return res.status(500).json({ message: "Server error during stock transfer.", error: err.message });
  } finally {
      // Release the connection back to the pool
      connection.release();
  }
};

//transfer details(post)
const getTransferDetails = async (req, res) => {
  try {
    // Fetch all transfer details from the database
    const getTransferQuery = `
      SELECT t.transfer_id, t.transfer_from, t.transfer_to, t.transfer_status, 
             t.transfer_date, t.transfer_time, p.product_id, p.product_name, 
             t.transfer_quantity, t.imei_number
      FROM transfer t
      JOIN products p ON t.product_name = p.product_name;
    `;
    const [transferRows] = await db.query(getTransferQuery);

    if (transferRows.length === 0) {
      return res.status(404).json({ message: "No transfer details found." });
    }

    // Process the results into the required response format
    const transferDetails = transferRows.reduce((acc, row) => {
      // Find if a transfer with this transfer_id already exists in the response array
      let transfer = acc.find(t => t.transfer_id === row.transfer_id);
      if (!transfer) {
        // If not, create a new transfer object
        transfer = {
          transfer_id: row.transfer_id,
          from: row.transfer_from,
          to: row.transfer_to,
          date: row.transfer_date.toISOString().split('T')[0],
          time: row.transfer_time,
          completed: row.transfer_status === 'completed',
          products: []
        };
        acc.push(transfer);
      }

      // Add the product details
      transfer.products.push({
        product_id: row.product_id,
        product_name: row.product_name,
        stock_quantity: row.stock_quantity, // Assuming you have this field
        transfer_quantity: row.transfer_quantity,
        imei_number: row.imei_number ? row.imei_number.split(',') : []
      });

      return acc;
    }, []);

    return res.status(200).json(transferDetails);
  } catch (err) {
    console.error("Error fetching transfer details:", err.message);
    return res.status(500).json({ message: "Server error while fetching transfer details." });
  }
};


  module.exports = {
    manageStock,
    getStockByProductAndStore,
    getStoresAndCategories,
    getBrandsByCategory,
    getProductsByCategoryAndBrand,
    transferStock,
    getTransferDetails

  };