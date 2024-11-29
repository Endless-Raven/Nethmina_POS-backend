const db = require("../config/db");

const cancelTransfer = async (req, res) => {
  const { transfer_id } = req.body;

  if (!transfer_id) {
    return res.status(400).json({ message: "Transfer ID is required." });
  }

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // Retrieve transfer details
    const [transferRows] = await connection.query(
      `SELECT transfer_from, product_id, transfer_quantity, imei_number, transfer_approval 
       FROM transfer WHERE transfer_id = ?`,
      [transfer_id]
    );

    if (!transferRows.length) {
      await connection.rollback();
      return res.status(400).json({ message: "Transfer record not found." });
    }

    const {
      transfer_from: main_branch,
      product_id,
      transfer_quantity,
      imei_number,
      transfer_approval,
    } = transferRows[0];

    if (transfer_approval === "received") {
      await connection.rollback();
      return res
        .status(400)
        .json({ message: "Cannot cancel a completed transfer." });
    }

    // Check if the product is a mobile phone with IMEI numbers
    const [productRows] = await connection.query(
      `SELECT product_type FROM products WHERE product_id = ?`,
      [product_id]
    );

    if (!productRows.length) {
      await connection.rollback();
      return res.status(400).json({ message: "Product not found." });
    }

    const { product_type } = productRows[0];

    // Restore stock quantity in the originating branch
    if (product_type === "Mobile Phone" && imei_number) {
      const restoreStockQuery = `
        UPDATE stock
        SET stock_quantity = stock_quantity + 1,
            imei_numbers = CONCAT(imei_numbers, ',', ?)
        WHERE product_id = ? AND store_name = ?;
      `;

      await connection.query(restoreStockQuery, [
        imei_number,
        product_id,
        main_branch,
      ]);
    } else {
      const restoreStockQuery = `
        UPDATE stock
        SET stock_quantity = stock_quantity + ?
        WHERE product_id = ? AND store_name = ?;
      `;
      await connection.query(restoreStockQuery, [
        transfer_quantity,
        product_id,
        main_branch,
      ]);
    }

    // Remove the transfer record
    const deleteTransferQuery = `DELETE FROM transfer WHERE transfer_id = ?`;
    await connection.query(deleteTransferQuery, [transfer_id]);

    await connection.commit();
    return res
      .status(200)
      .json({ message: "Transfer canceled and stock restored successfully." });
  } catch (err) {
    await connection.rollback();
    console.error("Error canceling transfer:", err.message);
    return res.status(500).json({
      message: "Error inside server during transfer cancellation.",
      err,
    });
  } finally {
    connection.release();
  }
};

const transferStock = async (req, res) => {
  const { products, from: main_branch_id, to: target_branch, user } = req.body;

  if (!products || !main_branch_id || !target_branch) {
    return res.status(400).json({
      message: "Invalid request body. Please include products, from, and to.",
    });
  }

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // Retrieve the store name using the store_id for main_branch
    const [mainBranchRows] = await connection.query(
      `SELECT store_name FROM stores WHERE store_id = ?`,
      [main_branch_id]
    );

    if (!mainBranchRows.length) {
      await connection.rollback();
      return res.status(400).json({ message: "Main branch not found." });
    }
    const main_branch = mainBranchRows[0].store_name;

    for (let product of products) {
      const product_id = parseInt(product.product_id, 10);
      const transfer_quantity = parseInt(product.transfer_quantity, 10);

      if (!product_id || !transfer_quantity) {
        await connection.rollback();
        return res
          .status(400)
          .json({ message: "Product ID or transfer quantity is invalid." });
      }

      const productQuery = `SELECT product_type, imei_number FROM products WHERE product_id = ?;`;
      const [productRows] = await connection.query(productQuery, [product_id]);

      if (!productRows.length) {
        await connection.rollback();
        return res.status(400).json({ message: "Product not found." });
      }
      const { product_type, imei_number } = productRows[0];

      if (product_type === "Mobile Phone") {
        let imei_number_list = Array.isArray(product.imei_number)
          ? product.imei_number.filter((num) => num.trim() !== "")
          : product.imei_number
          ? [product.imei_number.trim()]
          : [];

        if (imei_number_list.length !== transfer_quantity) {
          await connection.rollback();
          return res.status(400).json({
            message:
              "Provided IMEI numbers count does not match the transfer quantity.",
          });
        }

        const checkImeiQuery = `
            SELECT imei_numbers FROM stock
            WHERE product_id = ? AND store_name = ? AND stock_quantity >= ?;
          `;
        const [imeiRows] = await connection.query(checkImeiQuery, [
          product_id,
          main_branch,
          transfer_quantity,
        ]);

        if (
          !imeiRows.length ||
          !imei_number_list.every((num) =>
            imeiRows[0].imei_numbers.split(",").includes(num)
          )
        ) {
          await connection.rollback();
          return res.status(400).json({
            message: "IMEI numbers not available in the main branch stock.",
          });
        }

        const reduceMainStockQuery = `
            UPDATE stock
            SET stock_quantity = stock_quantity - ?, updated_at = NOW(),
                imei_numbers = TRIM(BOTH ',' FROM REPLACE(CONCAT(',', imei_numbers, ','), CONCAT(',', ?, ','), ',')) 
            WHERE product_id = ? AND store_name = ? AND stock_quantity >= ?;
          `;
        const reduceParams = [
          transfer_quantity,
          imei_number_list.join(","),
          product_id,
          main_branch,
          transfer_quantity,
        ];
        const [mainStockUpdated] = await connection.query(
          reduceMainStockQuery,
          reduceParams
        );

        if (mainStockUpdated.affectedRows === 0) {
          await connection.rollback();
          return res.status(400).json({
            message:
              "Insufficient stock in the main branch or product not found.",
          });
        }
      } else {
        const reduceMainStockQuery = `
            UPDATE stock
            SET stock_quantity = stock_quantity - ?, updated_at = NOW()
            WHERE product_id = ? AND store_name = ? AND stock_quantity >= ?;
          `;
        const reduceParams = [
          transfer_quantity,
          product_id,
          main_branch,
          transfer_quantity,
        ];
        const [mainStockUpdated] = await connection.query(
          reduceMainStockQuery,
          reduceParams
        );

        if (mainStockUpdated.affectedRows === 0) {
          await connection.rollback();
          return res.status(400).json({
            message:
              "Insufficient stock in the main branch or product not found.",
          });
        }
      }

      if (target_branch === "repair") {
        const checkStockQuery = `
          SELECT * FROM stock 
          WHERE product_id = ? AND store_name = ?;
        `;
        const [stockRows] = await connection.query(checkStockQuery, [
          product_id,
          target_branch,
        ]);

        if (stockRows.length > 0) {
          const imeiString = product.imei_number
            ? product.imei_number.join(",") + ","
            : "";
          const updateStockQuery = `
            UPDATE stock
            SET stock_quantity = stock_quantity + ?, 
                imei_numbers = CONCAT(imei_numbers, ?),
                updated_at = NOW()
            WHERE product_id = ? AND store_name = ?;
          `;
          await connection.query(updateStockQuery, [
            transfer_quantity,
            imeiString,
            product_id,
            target_branch,
          ]);
        } else {
          const insertStockQuery = `
            INSERT INTO stock (store_name, product_id, stock_quantity, imei_numbers, created_at, updated_at)
            VALUES (?, ?, ?, ?, NOW(), NOW());
          `;
          await connection.query(insertStockQuery, [
            target_branch,
            product_id,
            transfer_quantity,
            product.imei_number ? product.imei_number.join(",") : null,
          ]);
        }

        const reduceProductStockQuery = `
            UPDATE products 
            SET product_stock = product_stock - ?, updated_at = NOW()
            WHERE product_id = ? AND product_stock >= ?;
          `;
        const [productStockUpdateResult] = await connection.query(
          reduceProductStockQuery,
          [transfer_quantity, product_id, transfer_quantity]
        );

        if (productStockUpdateResult.affectedRows === 0) {
          await connection.rollback();
          return res.status(400).json({
            message: "Insufficient product stock in the products table.",
          });
        }

        if (product.imei_number && product.imei_number.length > 0) {
          const imeiToRemove = product.imei_number.join(",");
          const updateProductImeiQuery = `
            UPDATE products
            SET imei_number = TRIM(BOTH ',' FROM REPLACE(CONCAT(',', imei_number, ','), CONCAT(',', ?, ','), ',')),
                updated_at = NOW()
            WHERE product_id = ?;
          `;
          await connection.query(updateProductImeiQuery, [
            imeiToRemove,
            product_id,
          ]);
        }
      } else {
        // Insert each IMEI number separately into the transfer table
        if (product_type === "Mobile Phone" && product.imei_number) {
          for (const imei of product.imei_number) {
            const insertTransferQuery = `
              INSERT INTO transfer (
                transfer_from,
                transfer_to,
                transfer_approval,
                product_id,
                imei_number,
                transfer_quantity,
                user_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?);
            `;
            await connection.query(insertTransferQuery, [
              main_branch,
              target_branch,
              "sending",
              product_id,
              imei,
              1, // Since each row is for a single IMEI, quantity is 1
              user,
            ]);
          }
        } else {
          const insertTransferQuery = `
            INSERT INTO transfer (
              transfer_from,
              transfer_to,
              transfer_approval,
              product_id,
              imei_number,
              transfer_quantity,
              user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?);
          `;
          await connection.query(insertTransferQuery, [
            main_branch,
            target_branch,
            "sending",
            product_id,
            null,
            transfer_quantity,
            user,
          ]);
        }
      }
    }

    await connection.commit();
    return res.status(200).json({ message: "Transfer recorded successfully." });
  } catch (err) {
    await connection.rollback();
    console.error("Error processing stock transfer:", err.message);
    return res
      .status(500)
      .json({ message: "Error inside server during stock transfer.", err });
  } finally {
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
      return res.status(404).json({ message: "Product not found." });
    }

    const product_id = productRows[0].product_id;

    // Fetch stock details based on store_name and product_id
    const getStockDetailsQuery = `
        SELECT * FROM stock
        WHERE product_id = ? AND store_name = ?;
      `;
    const [stockRows] = await db.query(getStockDetailsQuery, [
      product_id,
      store_name,
    ]);

    if (stockRows.length === 0) {
      return res.status(404).json({
        message: "No stock found for this product in the specified store.",
      });
    }

    // Return the stock details
    return res.status(200).json(stockRows[0]);
  } catch (err) {
    console.error("Error fetching stock details:", err.message);
    return res.status(500).json({
      message: "Error inside server during fetching stock details.",
      err,
    });
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
    const stores = storesRows.map((row) => row.store_name);
    const product_types = productTypesRows.map((row) => row.product_type);

    // Respond with the shops and categories
    return res.status(200).json({
      stores,
      product_types,
    });
  } catch (err) {
    console.error("Error fetching shops and categories:", err.message);
    return res
      .status(500)
      .json({ message: "Server error while fetching shops and categories." });
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
      return res
        .status(404)
        .json({ message: "No brands found for this category." });
    }

    // Extract the brand names
    const brands = brandsRows.map((row) => row.brand_name); // Corrected here

    // Return the brands in the response
    return res.status(200).json(brands);
  } catch (err) {
    console.error("Error fetching brands by category:", err.message);
    return res
      .status(500)
      .json({ message: "Server error while fetching brands." });
  }
};

//get product details whne category and brand given(get)
const getProductsByCategoryAndBrand = async (req, res) => {
  const { product_type, brand_name } = req.query; // Get parameters from query

  // Check if both parameters are provided
  if (!product_type || !brand_name) {
    return res
      .status(400)
      .json({ message: "Product type and brand name are required." });
  }

  try {
    // Fetch products based on product_type and brand_name
    const getProductsQuery = `
            SELECT p.product_id, p.product_name, s.stock_quantity 
            FROM products p
            JOIN stock s ON p.product_id = s.product_id
            WHERE p.product_type = ? AND p.brand_name = ?;
        `;
    const [productRows] = await db.query(getProductsQuery, [
      product_type,
      brand_name,
    ]);

    // Check if any products were found
    if (productRows.length === 0) {
      return res
        .status(404)
        .json({ message: "No products found for this category and brand." });
    }

    // Return the products in the response
    return res.status(200).json(productRows);
  } catch (err) {
    console.error(
      "Error fetching products by category and brand:",
      err.message
    );
    return res
      .status(500)
      .json({ message: "Server error while fetching products." });
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
  const { products, store_id, req_from } = req.body;

  // Validate the request body
  if (
    !products ||
    !Array.isArray(products) ||
    products.length === 0 ||
    !store_id ||
    !req_from
  ) {
    return res.status(400).json({
      message: "Invalid request body. Please include products and store_id.",
    });
  }

  const connection = await db.getConnection(); // Get a connection from the pool
  await connection.beginTransaction(); // Start the transaction

  try {
    // Prepare the insert query for the requests
    const insertRequestQuery = `
      INSERT INTO request (request_time, is_seen, request_quantity, product_id, store_id,req_from)
      VALUES (NOW(), 0, ?, ?, ?, ?);
    `;

    for (const product of products) {
      const { product_id, request_quantity } = product; // Ensure this matches the request body

      // Validate product details
      if (
        !product_id ||
        !request_quantity ||
        request_quantity <= 0 ||
        !req_from
      ) {
        await connection.rollback(); // Rollback transaction on validation failure
        return res.status(400).json({ message: "Invalid product details." });
      }

      // Insert the product request into the request table
      await connection.query(insertRequestQuery, [
        request_quantity,
        product_id,
        store_id,
        req_from,
      ]);
    }

    // Commit the transaction
    await connection.commit();

    return res.status(200).json({ message: "Request added successfully." });
  } catch (err) {
    // Rollback transaction on error
    await connection.rollback();
    console.error("Error processing product request:", err.message);
    return res
      .status(500)
      .json({ message: "Error inside server while adding request.", err });
  } finally {
    // Release the connection back to the pool
    connection.release();
  }
};

const getProductRequests = async (req, res) => {
  const { store_id } = req.query;

  // Validate store_id
  if (!store_id) {
    return res
      .status(400)
      .json({ message: "Please provide a valid store_id." });
  }

  try {
    // Query to fetch requests for the given store
    const requestQuery = `
      SELECT 
        r.request_id,
        r.req_from,
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
      return res
        .status(404)
        .json({ message: "No requests found for this store." });
    }

    // Group requests by request_id
    const groupedRequests = {};
    requests.forEach((row) => {
      if (!groupedRequests[row.request_id]) {
        groupedRequests[row.request_id] = {
          request_id: row.request_id,
          req_from: row.req_from,
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
    return res
      .status(500)
      .json({ message: "Error inside server while fetching requests.", err });
  }
};

const deleteRequest = async (req, res) => {
  const { store_id, request_id } = req.query;

  // Validate input parameters
  if (!store_id || !request_id) {
    return res
      .status(400)
      .json({ message: "Please provide both store_id and request_id." });
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
    return res
      .status(500)
      .json({ message: "Error inside server while deleting request.", err });
  }
};

const getTransfersFromStore = async (req, res) => {
  const { store_id } = req.query;

  if (!store_id) {
    return res
      .status(400)
      .json({ message: "Please provide a valid store_id." });
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

    // Query to fetch transfer details where transfer_from = storeName
    const transferQuery = `
      SELECT 
        t.transfer_id,
        t.transfer_to AS 'to',
        DATE(t.transfer_date) AS date,
        TIME(t.transfer_time) AS time,
        t.transfer_approval,
        p.product_id,
        p.product_name,
        p.brand_name,
        p.product_type,
        t.transfer_quantity,
        t.imei_number
      FROM transfer t
      INNER JOIN products p ON t.product_id = p.product_id
      WHERE t.transfer_from = ?
        AND t.transfer_approval = 'sending';
    `;

    const [transfers] = await db.query(transferQuery, [storeName]);

    if (transfers.length === 0) {
      return res
        .status(404)
        .json({ message: "No transfers found for this store." });
    }

    // Grouping transfers by transfer_id
    const groupedTransfers = {};
    transfers.forEach((row) => {
      if (!groupedTransfers[row.transfer_id]) {
        groupedTransfers[row.transfer_id] = {
          transfer_id: row.transfer_id,
          to: row.to,
          date: row.date,
          time: row.time,
          transfer_approval: row.transfer_approval,
          products: [],
        };
      }
      groupedTransfers[row.transfer_id].products.push({
        product_id: row.product_id,
        product_name: row.product_name,
        imei_number: row.imei_number,
        brand_name: row.brand_name,
        product_type: row.product_type,
        transfer_quantity: row.transfer_quantity,
      });
    });

    // Convert the grouped object into an array
    const result = Object.values(groupedTransfers);

    return res.status(200).json(result);
  } catch (err) {
    console.error("Error fetching transfers initiated by store:", err.message);
    return res
      .status(500)
      .json({ message: "Server error while fetching transfers.", err });
  }
};

const getAllTransfers = async (req, res) => {
  const { store_id } = req.query;

  if (!store_id) {
    return res
      .status(400)
      .json({ message: "Please provide a valid store_id." });
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
        t.transfer_quantity,
        t.imei_number
      FROM transfer t
      INNER JOIN products p ON t.product_id = p.product_id
      WHERE t.transfer_to = ?
       AND t.transfer_approval = 'sending';
    `;

    const [transfers] = await db.query(transferQuery, [storeName]);

    if (transfers.length === 0) {
      return res
        .status(404)
        .json({ message: "No transfers found for this store." });
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
        imei_number: row.imei_number,
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
    return res
      .status(500)
      .json({ message: "Error inside server while fetching transfers.", err });
  }
};

const markTransferAsRead = async (req, res) => {
  const { transfer_id } = req.query;

  if (!transfer_id) {
    return res
      .status(400)
      .json({ message: "Please provide a valid transfer_id" });
  }

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // Update the transfer status to "received"
    const updateTransferQuery = `
      UPDATE transfer 
      SET transfer_approval = 'received' 
      WHERE transfer_id = ?;
    `;
    const [updateResult] = await connection.query(updateTransferQuery, [
      transfer_id,
    ]);

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Transfer not found." });
    }

    // Fetch transfer details including target store and product information
    const transferDetailsQuery = `
      SELECT transfer_to, product_id, transfer_quantity, imei_number 
      FROM transfer 
      WHERE transfer_id = ?;
    `;
    const [transferDetails] = await connection.query(transferDetailsQuery, [
      transfer_id,
    ]);

    if (transferDetails.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Transfer details not found." });
    }

    const {
      transfer_to: target_branch,
      product_id,
      transfer_quantity,
      imei_number,
    } = transferDetails[0];

    // Check if the product already exists in the target branch stock
    const checkStockQuery = `
SELECT imei_numbers FROM stock 
WHERE product_id = ? AND store_name = ?;
`;
    const [stockRows] = await connection.query(checkStockQuery, [
      product_id,
      target_branch,
    ]);

    // Format IMEI numbers based on whether it's a single or multiple IMEI numbers
    let imeiString = "";
    if (imei_number) {
      imeiString = Array.isArray(imei_number)
        ? imei_number.join(",")
        : imei_number;
      imeiString =
        stockRows.length > 0 && stockRows[0].imei_numbers
          ? `,${imeiString}`
          : imeiString; // Add comma if existing IMEI numbers present
    }

    if (stockRows.length > 0) {
      // Product exists, update stock quantity and append IMEI numbers
      const updateStockQuery = `
  UPDATE stock
  SET stock_quantity = stock_quantity + ?, 
      imei_numbers = CONCAT(imei_numbers, ?),
      updated_at = NOW()
  WHERE product_id = ? AND store_name = ?;
`;
      await connection.query(updateStockQuery, [
        transfer_quantity,
        imeiString,
        product_id,
        target_branch,
      ]);
    } else {
      // Product does not exist, insert new stock record
      const insertStockQuery = `
  INSERT INTO stock (store_name, product_id, stock_quantity, imei_numbers, created_at, updated_at)
  VALUES (?, ?, ?, ?, NOW(), NOW());
`;
      await connection.query(insertStockQuery, [
        target_branch,
        product_id,
        transfer_quantity,
        imeiString,
      ]);
    }

    // Commit the transaction
    await connection.commit();

    return res.status(200).json({
      message:
        "Transfer marked as received and stock updated for the target branch.",
    });
  } catch (err) {
    // Rollback transaction on error
    await connection.rollback();
    console.error(
      "Error marking transfer as read and updating stock:",
      err.message
    );
    return res.status(500).json({
      message:
        "Error inside server while marking transfer as read and updating stock",
      err,
    });
  } finally {
    // Release the connection back to the pool
    connection.release();
  }
};

const getAllPendingRequestsbyreqfrom = async (req, res) => {
  try {
    const { store_id } = req.body; // Accessing store_id from query parameters

    if (!store_id) {
      return res.status(400).json({ message: "Store ID is required." });
    }

    // Assuming the rest of your logic follows here...
    // For example, querying the store name and pending requests...

    // Your query to fetch store_name (if needed)
    const storeQuery = `SELECT store_name FROM stores WHERE store_id = ?`;
    const [storeResult] = await db.query(storeQuery, [store_id]);

    if (storeResult.length === 0) {
      return res.status(404).json({ message: "Store not found." });
    }

    const storeName = storeResult[0].store_name;

    // Your query to fetch pending requests
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
      WHERE r.is_seen = 0 AND req_from = ?
      ORDER BY r.request_id, r.request_time;
    `;

    const [requests] = await db.query(pendingRequestsQuery, [storeName]);

    if (requests.length === 0) {
      return res.status(404).json({ message: "No pending requests found." });
    }

    // Grouping requests by request_id and shop
    const groupedRequests = {};
    requests.forEach((row) => {
      const {
        request_id,
        shop,
        date,
        time,
        product_name,
        brand_name,
        product_type,
        request_quantity,
      } = row;

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
    return res.status(500).json({
      message: "Error inside server while fetching pending requests.",
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
        r.req_from,
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
      const {
        request_id,
        req_from,
        shop,
        date,
        time,
        product_name,
        brand_name,
        product_type,
        request_quantity,
      } = row;

      if (!groupedRequests[request_id]) {
        groupedRequests[request_id] = {
          request_id,
          req_from,
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
    return res.status(500).json({
      message: "Error inside server while fetching pending requests.",
      err,
    });
  }
};

const getTransferDetails = async (req, res) => {
  try {
    // SQL query to retrieve transfer details with associated product data
    const sql = `
          SELECT 
              t.transfer_id,
              t.transfer_from AS 'from',
              t.transfer_to AS 'to',
              t.transfer_date AS 'date',
              t.transfer_time AS 'time',
              t.transfer_approval,
              p.product_id,
              p.product_name,
              p.product_stock,
              t.transfer_quantity,
              t.imei_number
          FROM 
              transfer t
          LEFT JOIN 
              products p ON t.product_id = p.product_id
          ORDER BY 
              t.transfer_id, p.product_id;
      `;

    const [transfers] = await db.query(sql);

    if (!transfers || transfers.length === 0) {
      return res.status(404).json({ message: "No transfer records found." });
    }

    // Format transfer data
    const formattedTransfers = transfers.reduce((acc, row) => {
      let transfer = acc.find((t) => t.transfer_id === row.transfer_id);

      if (!transfer) {
        transfer = {
          transfer_id: row.transfer_id,
          products: [],
          from: row.from,
          to: row.to,
          date: row.date,
          time: row.time,
          completed: row.transfer_approval === "received",
        };
        acc.push(transfer);
      }

      // Convert comma-separated IMEI numbers to an array
      const imeiNumbers = row.imei_number ? row.imei_number.split(",") : [];

      // Add product details
      transfer.products.push({
        product_id: row.product_id,
        product_name: row.product_name,
        stock_quantity: row.product_stock,
        transfer_quantity: row.transfer_quantity,
        imei_number: imeiNumbers,
      });

      return acc;
    }, []);

    return res.json(formattedTransfers);
  } catch (err) {
    console.error("Error fetching transfer details:", err.message);
    return res
      .status(500)
      .json({ message: "Error fetching transfer details", err });
  }
};

const markRequestAsRead = async (req, res) => {
  const { request_id } = req.query;

  // Validate the request ID
  if (!request_id) {
    return res
      .status(400)
      .json({ message: "Please provide a valid request_id." });
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
      return res
        .status(404)
        .json({ message: "Request not found or already marked as read." });
    }

    return res
      .status(200)
      .json({ message: "Request status updated successfully." });
  } catch (err) {
    console.error("Error marking request as read:", err.message);
    return res.status(500).json({
      message: "Error inside server while updating request status.",
      err,
    });
  }
};

const getProductDetailsByIMEIOrCode = async (req, res) => {
  const { product_code } = req.body;

  try {
    let productQuery = "";
    let queryParams = product_code;

    // Run the first query based on product code
    productQuery = `
      SELECT * FROM products
      WHERE product_code = ?;
    `;

    let [productRows] = await db.query(productQuery, [queryParams]);

    // If no data is found with product code, try the IMEI number query
    if (productRows.length === 0) {
      productQuery = `
        SELECT * FROM products
        WHERE FIND_IN_SET(?, imei_number) > 0;
      `;
      [productRows] = await db.query(productQuery, [queryParams]);
    }

    if (productRows.length === 0) {
      return res.status(404).json({ message: "Product not found." });
    }

    // Return product details
    return res.status(200).json(productRows[0]);
  } catch (err) {
    console.error("Error fetching product details:", err.message);
    return res.status(500).json({
      message: "Error inside server during fetching product details.",
      err,
    });
  }
};

const deleteProductOrIMEI = async (req, res) => {
  const { product_id, store_id, imei_number, quantity } = req.body;
console.log(req.body);
  // If imei_number is a string, split it into an array, otherwise, set it to an empty array.
  const imeiNumbers =
    typeof imei_number === "string" && imei_number.trim() !== ""
      ? imei_number.split(",")
      : [];

  try {
    const store_name = store_id;

    // Get current product type, IMEI numbers, and stock quantity from `products` table
    const [productRows] = await db.query(
      `SELECT product_type, imei_number, product_stock FROM products WHERE product_id = ?`,
      [product_id]
    );
    const productRow = productRows[0];

    if (!productRow) {
      return res.status(404).json({ message: "Product not found." });
    }

    const {
      product_type,
      imei_number: existingIMEI,
      product_stock,
    } = productRow;

    // If the product type is not "Mobile Phone", delete the product from the store stock.
    // If the product type is not "Mobile Phone", update the stock in the store.
    if (product_type !== "Mobile Phone") {
      // Reduce the stock quantity in the stock table
      const [stockEntry] = await db.query(
        `SELECT stock_quantity FROM stock WHERE product_id = ? AND store_name = ?`,
        [product_id, store_name]
      );
      if (stockEntry) {
        const updatedStockQuantity = stockEntry[0].stock_quantity - quantity;
       
        if (updatedStockQuantity < 0) {
          return res.status(400).json({
            message: "Insufficient stock to process the reduction.",
          });
        }

        await db.query(
          `UPDATE stock SET stock_quantity = ?, updated_at = NOW() WHERE product_id = ? AND store_name = ?`,
          [updatedStockQuantity, product_id, store_name]
        );

        // Update the stock in the products table
        const newProductStock = product_stock - quantity;
        await db.query(
          `UPDATE products SET product_stock = ?, updated_at = NOW() WHERE product_id = ?`,
          [newProductStock, product_id]
        );

        return res.status(200).json({
          message: "Stock quantity updated for non-mobile phone product.",
        });
      } else {
        return res.status(404).json({
          message: "Product not found in store stock.",
        });
      }
    }

    // Handle Mobile Phone: Get current IMEIs and stock quantity from `stock` table
    const [stockRows] = await db.query(
      `SELECT imei_numbers, stock_quantity FROM stock WHERE product_id = ? AND store_name = ?`,
      [product_id, store_name]
    );
    const stockRow = stockRows[0];

    if (!stockRow) {
      return res
        .status(404)
        .json({ message: "Product not found in this store." });
    }

    let newStockQuantity = stockRow.stock_quantity;

    // Handle IMEI number deletion
    if (imeiNumbers.length > 0) {
      const currentStockIMEIs = stockRow.imei_numbers
        ? stockRow.imei_numbers.split(",")
        : [];
      const updatedStockIMEIs = currentStockIMEIs.filter(
        (imei) => !imeiNumbers.includes(imei)
      );
      newStockQuantity = stockRow.stock_quantity - imeiNumbers.length;

      // Update the `stock` table with new IMEI list and quantity
      await db.query(
        `UPDATE stock SET imei_numbers = ?, stock_quantity = ?, updated_at = NOW() WHERE product_id = ? AND store_name = ?`,
        [updatedStockIMEIs.join(","), newStockQuantity, product_id, store_name]
      );
    } else if (quantity > 0) {
      // If no IMEI numbers are provided, reduce the stock based on the quantity.
      newStockQuantity = stockRow.stock_quantity - quantity;

      // Update the `stock` table without affecting IMEIs
      await db.query(
        `UPDATE stock SET stock_quantity = ?, updated_at = NOW() WHERE product_id = ? AND store_name = ?`,
        [newStockQuantity, product_id, store_name]
      );
    }

    // Get current IMEIs and stock from `products` table
    let updatedProductIMEIs = existingIMEI ? existingIMEI.split(",") : [];
    let newProductStock = product_stock;

    // Handle IMEI number removal from `products` table
    if (imeiNumbers.length > 0) {
      updatedProductIMEIs = updatedProductIMEIs.filter(
        (imei) => !imeiNumbers.includes(imei)
      );
      newProductStock = product_stock - imeiNumbers.length;

      // Update the `products` table with new IMEI list and stock
      await db.query(
        `UPDATE products SET imei_number = ?, product_stock = ?, updated_at = NOW() WHERE product_id = ?`,
        [updatedProductIMEIs.join(","), newProductStock, product_id]
      );
    } else if (quantity > 0) {
      // If no IMEI numbers were provided, reduce stock by the given quantity
      newProductStock = product_stock - quantity;

      // Update the `products` table with updated stock quantity
      await db.query(
        `UPDATE products SET product_stock = ?, updated_at = NOW() WHERE product_id = ?`,
        [newProductStock, product_id]
      );
    }

    return res.status(200).json({
      message:
        "Product or IMEI numbers removed successfully and stock updated.",
    });
  } catch (err) {
    console.error("Error updating/deleting product:", err.message);
    return res.status(500).json({
      message: "Error inside server during update/delete.",
      error: err.message,
    });
  }
};

module.exports = {
  getStockByProductAndStore,
  getProductDetailsByIMEIOrCode,
  getStoresAndCategories,
  getBrandsByCategory,
  getProductsByCategoryAndBrand,
  transferStock,
  getAllPendingRequests,
  markRequestAsRead,
  getTransferDetails,
  requestProduct,
  getProductRequests,
  deleteRequest,
  getAllTransfers,
  markTransferAsRead,
  deleteProductOrIMEI,
  getAllPendingRequestsbyreqfrom,
  cancelTransfer,
  getTransfersFromStore,
};
