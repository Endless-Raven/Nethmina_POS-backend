const db = require("../config/db");

//manages stock(post request)
const transferStock = async (req, res) => {
  console.log("Request body", req.body);

  const { products, from: main_branch, to: target_branch } = req.body;

  if (!products || !main_branch || !target_branch) {
    return res.status(400).json({ message: "Invalid request body. Please include products, from, and to." });
  }

  const connection = await db.getConnection(); // Get a connection from the pool
  await connection.beginTransaction(); // Start the transaction

  try {
    for (let product of products) {
      const { product_id, transfer_quantity, imei_number = [] } = product;

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
          SET stock_quantity = stock_quantity + ?, updated_at = NOW()
          ${imei_number.length ? ", imei_numbers = CONCAT(imei_numbers, ?, ',')" : ""}
          WHERE product_id = ? AND store_name = ?;
        `;
        const updateParams = imei_number.length
          ? [transfer_quantity, imei_number.join(','), product_id, target_branch]
          : [transfer_quantity, product_id, target_branch];
        await connection.query(updateStockQuery, updateParams);
      } else {
        // Product doesn't exist in the target branch, create a new row
        const insertStockQuery = `
          INSERT INTO stock (store_name, product_id, stock_quantity, created_at, updated_at${imei_number.length ? ", imei_numbers" : ""})
          VALUES (?, ?, ?, NOW(), NOW()${imei_number.length ? ", ?" : ""});
        `;
        const insertParams = imei_number.length
          ? [target_branch, product_id, transfer_quantity, imei_number.join(',')]
          : [target_branch, product_id, transfer_quantity];
        await connection.query(insertStockQuery, insertParams);
      }

      // Reduce the stock from the main branch
      const reduceMainStockQuery = `
        UPDATE stock
        SET stock_quantity = stock_quantity - ?, updated_at = NOW()
        ${imei_number.length ? ", imei_numbers = REPLACE(imei_numbers, ?, '')" : ""}
        WHERE product_id = ? AND store_name = ? AND stock_quantity >= ?;
      `;
      const reduceParams = imei_number.length
        ? [transfer_quantity, imei_number.join(','), product_id, main_branch, transfer_quantity]
        : [transfer_quantity, product_id, main_branch, transfer_quantity];
      const [mainStockUpdated] = await connection.query(reduceMainStockQuery, reduceParams);

      if (mainStockUpdated.affectedRows === 0) {
        // Rollback transaction if there's insufficient stock or product not found
        await connection.rollback();
        return res.status(400).json({ message: "Insufficient stock in the main branch or product not found." });
      }

      // Log the transfer details in the `transfer` table
      const insertTransferQuery = `
        INSERT INTO transfer (
          transfer_from,
          transfer_to,
          transfer_approval,
          product_id,
          ${imei_number.length ? "imei_number," : ""}
          transfer_quantity
        ) VALUES (?, ?, ?, ?, ${imei_number.length ? "?, " : ""}?);
      `;
      const transferParams = imei_number.length
        ? [main_branch, target_branch, "sending", product_id, imei_number.join(','), transfer_quantity]
        : [main_branch, target_branch, "sending", product_id, transfer_quantity];
      await connection.query(insertTransferQuery, transferParams);
    }

    // Commit the transaction
    await connection.commit();

    return res.status(200).json({ message: "transfer started" });
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
// const transferStock = async (req, res) => {
//   const { products, from, to } = req.body;

//   // Validate request body
//   if (!products || products.length === 0 || !from || !to) {
//       return res.status(400).json({ message: "Invalid request body. Please provide products, from, and to fields." });
//   }

//   // Create transfer ID, date, and time
//   const date = new Date().toISOString().split('T')[0]; // yyyy-mm-dd format
//   const time = new Date().toISOString().split('T')[1].split('.')[0]; // hh:mm:ss format

//   // Start a transaction
//   const connection = await db.getConnection(); // Get DB connection
//   await connection.beginTransaction();

//   try {
//       // Insert transfer record into the transfers table
//       const createTransferQuery = `
//           INSERT INTO transfers ( from_store, to_store, date, time, completed) 
//           VALUES (?, ?, ?, ?, ?);
//       `;
//       await connection.query(createTransferQuery, [ from, to, date, time, false]);

//       // Iterate over each product and update stock
//       for (const product of products) {
//           const { product_id, transfer_quantity, imei_number } = product;

//           // Validate transfer_quantity
//           if (!transfer_quantity || transfer_quantity <= 0) {
//               throw new Error(`Invalid transfer quantity for product ID ${product_id}.`);
//           }

//           // Check if the 'from' store has sufficient stock
//           const checkStockQuery = `
//               SELECT stock_quantity FROM stock 
//               WHERE product_id = ? AND store_name = ?;
//           `;
//           const [stockRows] = await connection.query(checkStockQuery, [product_id, from]);

//           if (stockRows.length === 0 || stockRows[0].stock_quantity < transfer_quantity) {
//               throw new Error(`Insufficient stock for product ID ${product_id} in ${from}.`);
//           }

//           // Reduce stock in the 'from' store
//           const reduceStockQuery = `
//               UPDATE stock 
//               SET stock_quantity = stock_quantity - ? 
//               WHERE product_id = ? AND store_name = ?;
//           `;
//           await connection.query(reduceStockQuery, [transfer_quantity, product_id, from]);

//           // Add stock to the 'to' store
//           const checkToStockQuery = `
//               SELECT stock_quantity FROM stock 
//               WHERE product_id = ? AND store_name = ?;
//           `;
//           const [toStockRows] = await connection.query(checkToStockQuery, [product_id, to]);

//           if (toStockRows.length > 0) {
//               // Product exists in the 'to' store, update stock
//               const updateToStockQuery = `
//                   UPDATE stock 
//                   SET stock_quantity = stock_quantity + ? 
//                   WHERE product_id = ? AND store_name = ?;
//               `;
//               await connection.query(updateToStockQuery, [transfer_quantity, product_id, to]);
//           } else {
//               // Product doesn't exist in the 'to' store, create new stock entry
//               const insertToStockQuery = `
//                   INSERT INTO stock (product_id, store_name, stock_quantity) 
//                   VALUES (?, ?, ?);
//               `;
//               await connection.query(insertToStockQuery, [product_id, to, transfer_quantity]);
//           }

//           // Handle IMEI numbers if present
//           if (imei_number && imei_number.length > 0) {
//               const insertImeiQuery = `
//                   INSERT INTO imei_numbers (product_id, imei_number, store_name, transfer_id)
//                   VALUES (?, ?, ?, ?);
//               `;
//               for (const imei of imei_number) {
//                   await connection.query(insertImeiQuery, [product_id, imei, to, transferId]);
//               }
//           }
//       }

//       // Commit the transaction
//       await connection.commit();

//       // Send response
//       return res.status(200).json({
//           message: "Stock transfer successful.",
//           transfer_id: transferId,
//           date,
//           time,
//           completed: false,
//       });
//   } catch (err) {
//       // Rollback transaction on error
//       await connection.rollback();
//       console.error("Error during stock transfer:", err.message);
//       return res.status(500).json({ message: "Server error during stock transfer.", error: err.message });
//   } finally {
//       // Release the connection back to the pool
//       connection.release();
//   }
// };

//transfer details(post)
// const getTransferDetails = async (req, res) => {
//   try {
//     // Fetch all transfer details from the database
//     const getTransferQuery = `
//       SELECT t.transfer_id, t.transfer_from, t.transfer_to, t.transfer_status, 
//              t.transfer_date, t.transfer_time, p.product_id, p.product_name, 
//              t.transfer_quantity, t.imei_number
//       FROM transfer t
//       JOIN products p ON t.product_name = p.product_name;
//     `;
//     const [transferRows] = await db.query(getTransferQuery);

//     if (transferRows.length === 0) {
//       return res.status(404).json({ message: "No transfer details found." });
//     }

//     // Process the results into the required response format
//     const transferDetails = transferRows.reduce((acc, row) => {
//       // Find if a transfer with this transfer_id already exists in the response array
//       let transfer = acc.find(t => t.transfer_id === row.transfer_id);
//       if (!transfer) {
//         // If not, create a new transfer object
//         transfer = {
//           transfer_id: row.transfer_id,
//           from: row.transfer_from,
//           to: row.transfer_to,
//           date: row.transfer_date.toISOString().split('T')[0],
//           time: row.transfer_time,
//           completed: row.transfer_status === 'completed',
//           products: []
//         };
//         acc.push(transfer);
//       }

//       // Add the product details
//       transfer.products.push({
//         product_id: row.product_id,
//         product_name: row.product_name,
//         stock_quantity: row.stock_quantity, // Assuming you have this field
//         transfer_quantity: row.transfer_quantity,
//         imei_number: row.imei_number ? row.imei_number.split(',') : []
//       });

//       return acc;
//     }, []);

//     return res.status(200).json(transferDetails);
//   } catch (err) {
//     console.error("Error fetching transfer details:", err.message);
//     return res.status(500).json({ message: "Server error while fetching transfer details." });
//   }
// };


// Function to handle product requests
const requestProduct = async (req, res) => {
  const { products, store_id } = req.body;

  // Validate the request body
  if (!products || !Array.isArray(products) || products.length === 0 || !store_id) {
    return res.status(400).json({ message: "Invalid request body. Please include products and store_id." });
  }

  const connection = await db.getConnection(); // Get a connection from the pool
  await connection.beginTransaction(); // Start the transaction

  try {
    // Prepare the insert query for the requests
    const insertRequestQuery = `
      INSERT INTO request (request_time, is_seen, request_quantity, product_id, store_id)
      VALUES (NOW(), 0, ?, ?, ?);
    `;

    for (const product of products) {
      const { product_id, request_quantity } = product; // Ensure this matches the request body

      // Validate product details
      if (!product_id || !request_quantity || request_quantity <= 0) {
        await connection.rollback(); // Rollback transaction on validation failure
        return res.status(400).json({ message: "Invalid product details." });
      }

      // Insert the product request into the request table
      await connection.query(insertRequestQuery, [request_quantity, product_id, store_id]);
    }

    // Commit the transaction
    await connection.commit();

    return res.status(200).json({ message: "Request added successfully." });
  } catch (err) {
    // Rollback transaction on error
    await connection.rollback();
    console.error("Error processing product request:", err.message);
    return res.status(500).json({ message: "Error inside server while adding request.", err });
  } finally {
    // Release the connection back to the pool
    connection.release();
  }
};




const getProductRequests = async (req, res) => {
  const { store_id } = req.query;

  // Validate store_id
  if (!store_id) {
    return res.status(400).json({ message: "Please provide a valid store_id." });
  }

  try {
    // Query to fetch requests for the given store
    const requestQuery = `
      SELECT 
        r.request_id,
        DATE(r.request_time) AS date,
        TIME(r.request_time) AS time,
        r.is_seen,
        r.request_quantity,
        p.product_id,
        p.product_name,
        p.brand_name,
        p.product_type
      FROM request r
      INNER JOIN products p ON r.product_id = p.product_id
      WHERE r.store_id = ?
      ORDER BY r.request_time DESC;  -- Optionally order by request time
    `;

    const [requests] = await db.query(requestQuery, [store_id]);

    if (requests.length === 0) {
      return res.status(404).json({ message: "No requests found for this store." });
    }

    // Group requests by request_id
    const groupedRequests = {};
    requests.forEach((row) => {
      if (!groupedRequests[row.request_id]) {
        groupedRequests[row.request_id] = {
          request_id: row.request_id,
          date: row.date,
          time: row.time,
          is_seen: Boolean(row.is_seen),
          products: [],
        };
      }
      groupedRequests[row.request_id].products.push({
        product_id: row.product_id,
        product_name: row.product_name,
        brand_name: row.brand_name,
        product_type: row.product_type,
        request_quentity: row.request_quantity,
      });
    });

    // Convert the grouped object into an array
    const result = Object.values(groupedRequests);

    return res.status(200).json(result);
  } catch (err) {
    console.error("Error fetching requests:", err.message);
    return res.status(500).json({ message: "Error inside server while fetching requests.", err });
  }
};

const deleteRequest = async (req, res) => {
  const { store_id, request_id } = req.query;

  // Validate input parameters
  if (!store_id || !request_id) {
    return res.status(400).json({ message: "Please provide both store_id and request_id." });
  }

  try {
    // Query to delete the request from the `request` table
    const deleteQuery = `
      DELETE FROM request
      WHERE request_id = ? AND store_id = ?;
    `;

    const [result] = await db.query(deleteQuery, [request_id, store_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "No request found with the given request_id and store_id.",
      });
    }

    return res.status(200).json({ message: "Request deleted successfully." });
  } catch (err) {
    console.error("Error deleting request:", err.message);
    return res.status(500).json({ message: "Error inside server while deleting request.", err });
  }
};


const getAllTransfers = async (req, res) => {
  const { store_id } = req.query;

  if (!store_id) {
    return res.status(400).json({ message: "Please provide a valid store_id." });
  }

  try {
    // First, get the store name using the store_id
    const storeQuery = `
      SELECT store_name FROM stores
      WHERE store_id = ?;
    `;
    const [storeRows] = await db.query(storeQuery, [store_id]);

    if (storeRows.length === 0) {
      return res.status(404).json({ message: "Store not found." });
    }

    const storeName = storeRows[0].store_name;

    // Now query to fetch transfer details for the given store name
    const transferQuery = `
      SELECT 
        t.transfer_id,
        t.transfer_from AS 'from',
        DATE(t.transfer_date) AS date,
        TIME(t.transfer_time) AS time,
        t.transfer_approval,
        p.product_id,
        p.product_name,
        p.brand_name,
        p.product_type,
        t.transfer_quantity
      FROM transfer t
      INNER JOIN products p ON t.product_id = p.product_id
      WHERE t.transfer_to = ?;
    `;

    const [transfers] = await db.query(transferQuery, [storeName]);

    if (transfers.length === 0) {
      return res.status(404).json({ message: "No transfers found for this store." });
    }

    // Grouping transfers by transfer_id
    const groupedTransfers = {};
    transfers.forEach((row) => {
      if (!groupedTransfers[row.transfer_id]) {
        groupedTransfers[row.transfer_id] = {
          transfer_id: row.transfer_id,
          from: row.from,
          date: row.date,
          time: row.time,
          transfer_approval: row.transfer_approval, // Include transfer approval
          products: [],
        };
      }
      groupedTransfers[row.transfer_id].products.push({
        product_id: row.product_id,
        product_name: row.product_name,
        brand_name: row.brand_name,
        product_type: row.product_type,
        transfer_quantity: row.transfer_quantity,
      });
    });

    // Convert the grouped object into an array
    const result = Object.values(groupedTransfers);

    return res.status(200).json(result);
  } catch (err) {
    console.error("Error fetching transfers from admin:", err.message);
    return res.status(500).json({ message: "Error inside server while fetching transfers.", err });
  }
};

const markTransferAsRead = async (req, res) => {
  const { transfer_id } = req.query;

  if (!transfer_id) {
    return res
      .status(400)
      .json({ message: "Please provide a valid transfer_id" });
  }

  try {
    // Query to update the transfer status to "read" or equivalent
    const updateQuery = `
      UPDATE transfer 
      SET transfer_approval = 'received' 
      WHERE transfer_id = ?;
    `;

    const [result] = await db.query(updateQuery, [transfer_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Transfer not found." });
    }

    return res.status(200).json({ message: "Transfer marked as read." });
  } catch (err) {
    console.error("Error marking transfer as read:", err.message);
    return res.status(500).json({
      message: "Error inside server while marking transfer as read",
      err,
    });
  }
};

const getAllPendingRequests = async (req, res) => {
  try {
    // Query to get all pending requests for all shops
    const pendingRequestsQuery = `
      SELECT 
        r.request_id,
        s.store_name AS shop,
        DATE(r.request_time) AS date,
        TIME(r.request_time) AS time,
        p.product_name,
        p.brand_name,
        p.product_type,
        r.request_quantity
      FROM request r
      INNER JOIN products p ON r.product_id = p.product_id
      INNER JOIN stores s ON r.store_id = s.store_id
      WHERE r.is_seen = 0
      ORDER BY r.request_id, r.request_time;
    `;

    const [requests] = await db.query(pendingRequestsQuery);

    if (requests.length === 0) {
      return res.status(404).json({ message: "No pending requests found." });
    }

    // Grouping requests by request_id and shop
    const groupedRequests = {};
    requests.forEach((row) => {
      const { request_id, shop, date, time, product_name, brand_name, product_type, request_quantity } = row;

      if (!groupedRequests[request_id]) {
        groupedRequests[request_id] = {
          request_id,
          shop,
          date,
          time,
          products: [],
        };
      }

      groupedRequests[request_id].products.push({
        product_name,
        brand_name,
        product_type,
        request_quantity,
      });
    });

    // Convert the grouped object into an array
    const result = Object.values(groupedRequests);

    return res.status(200).json(result);
  } catch (err) {
    console.error("Error fetching pending requests:", err.message);
    return res
      .status(500)
      .json({ message: "Error inside server while fetching pending requests.", err });
  }
};

const markRequestAsRead = async (req, res) => {
  const { request_id } = req.query;

  // Validate the request ID
  if (!request_id) {
    return res.status(400).json({ message: "Please provide a valid request_id." });
  }

  try {
    // Update query to mark the request as read
    const updateRequestQuery = `
      UPDATE request
      SET is_seen = 1
      WHERE request_id = ?;
    `;

    const [result] = await db.query(updateRequestQuery, [request_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Request not found or already marked as read." });
    }

    return res.status(200).json({ message: "Request status updated successfully." });
  } catch (err) {
    console.error("Error marking request as read:", err.message);
    return res.status(500).json({ message: "Error inside server while updating request status.", err });
  }
};




  module.exports = {
    
    getStockByProductAndStore,
    
    getStoresAndCategories,
    getBrandsByCategory,
    getProductsByCategoryAndBrand,
    transferStock,
    getAllPendingRequests,
    markRequestAsRead,
    
    requestProduct,
    getProductRequests,
    deleteRequest,
    getAllTransfers,
    markTransferAsRead,
 
  };