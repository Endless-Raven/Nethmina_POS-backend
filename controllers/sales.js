const db = require("../config/db");

 // Step 1: Generate the next ID
// Function to generate the next ID based on store name
const generateNextId = async (store_name) => {
  // Get the first two letters of the store_name
  const prefix = store_name.substring(0, 2).toLowerCase(); // Ensure it’s in lowercase

  // Query to get the maximum sale_id from the sales table
  const query = "SELECT sale_id FROM sales";
  const [results] = await db.query(query);

  // If there are no sales in the database, return the first ID for the user
  if (results.length === 0) {
    return `${prefix}0001`;
  }

  // Convert sale_id to string and extract the numeric part
  const ids = results.map(sale => parseInt(sale.sale_id.slice(2))); // Skip the first 2 characters (prefix)

  // Get the maximum ID
  const maxId = Math.max(...ids);

  // Generate the next ID by incrementing the maxId and padding it to 4 digits
  return `${prefix}${(maxId + 1).toString().padStart(4, "0")}`;
};


// Function to get store name by user ID
const getStoreNameByUser = async (user_id) => {
  const sql = `
    SELECT store_name 
    FROM stores
    INNER JOIN users ON users.store_id = stores.store_id
    WHERE users.user_id = ?;
  `;
  
  const [rows] = await db.query(sql, [user_id]);
  
  if (rows.length === 0) {
    throw new Error(`Store not found for user ID: ${user_id}`);
  }

  return rows[0].store_name;
};

// Function to make a sale
const makesale = async (req, res) => {
  try {
    const { cashier_id, sales_person, total_amount, products, user } = req.body;

    // Retrieve store_name based on user (user_id)
    const store_name = await getStoreNameByUser(user);
    console.log(`Store name for user ${user}: ${store_name}`);

    const sales_id = await generateNextId(store_name); // Pass store_name

    if (!sales_id) {
      return res.status(500).json({ message: "Failed to generate sales ID." });
    }

    const salesQuery = `
      INSERT INTO sales (sale_id, cashier_id, sales_person, total_amount)
      VALUES (?, ?, ?, ?);
    `;

    await db.query(salesQuery, [sales_id, cashier_id, sales_person, total_amount]);
    console.log(sales_id);
    
    const salesItemQuery = `
      INSERT INTO sales_items (sale_id, product_id, item_quantity, item_price, imei_number, discount)
      VALUES (?, ?, ?, ?, ?, ?);
    `;

    const updateProductStockAndImeiQuery = `
      UPDATE products
      SET product_stock = product_stock - ?, imei_number = ?
      WHERE product_id = ? AND product_stock >= ?;
    `;

    // New query for updating the stock table
    const updateStockQuery = `
      UPDATE stock
      SET stock_quantity = stock_quantity - ?
      WHERE store_id = ? AND product_id = ?;
    `;

    // Retrieve store_id based on store_name
    const [storeResult] = await db.query("SELECT store_id FROM stores WHERE store_name = ?", [store_name]);
    const store_id = storeResult[0]?.store_id;

    if (!store_id) {
      return res.status(404).json({ message: "Store not found." });
    }

    for (const product of products) {
      const { product_id, item_quantity, item_price, imei_number, discount } = product;

      try {
        // Insert into the sales_items table
        await db.query(salesItemQuery, [sales_id, product_id, item_quantity, item_price, imei_number, discount]);

        // Fetch current IMEI numbers
        const [currentImeiResult] = await db.query("SELECT imei_number FROM products WHERE product_id = ?", [product_id]);
        const currentImeiNumbers = currentImeiResult[0]?.imei_number.split(",") || [];

        // Remove the sold IMEI number from the array
        const updatedImeiNumbers = currentImeiNumbers.filter(imei => imei !== imei_number).join(",");

        // Update stock and IMEI numbers in the products table
        const [productStockUpdated] = await db.query(updateProductStockAndImeiQuery, [item_quantity, updatedImeiNumbers, product_id, item_quantity]);

        if (productStockUpdated.affectedRows === 0) {
          throw new Error(`Insufficient product stock for product ${product_id}.`);
        }

        // Update stock_quantity in the stock table
        const [stockUpdated] = await db.query(updateStockQuery, [item_quantity, store_id, product_id]);

        if (stockUpdated.affectedRows === 0) {
          throw new Error(`Failed to update stock for product ${product_id} in store ${store_id}.`);
        }

      } catch (err) {
        console.error(`Error processing product ${product_id}:`, err.message);
        return res.status(500).json({ message: `Error processing product ${product_id}.`, err });
      }
    }

    return res.status(200).json({ message: "Sales and items added successfully.", sales_id });

  } catch (err) {
    console.error("Error processing sales and items:", err.message);
    return res.status(500).json({ message: "Error inside server during sales processing.", err });
  }
};





const getsales = async (req,res) => {
    console.log("Request body",req.body);


    const sql = "SELECT * FROM sales";
    
    try {
      console.log("get products");
      const [rows] = await db.query(sql);
      return res.json(rows);
    } catch (err) {
      console.error("Error fetching products:", err.message);
      return res.status(500).json({ message: "Error inside server", err });
    }

};

    const getsalebyid = async (req, res) => {
  // Extract sale_id from the request parameters
  const { sale_id } = req.params;

  const sql = "SELECT * FROM sales WHERE sale_id = ?";

  try {
    console.log("Fetching sale with ID:", sale_id);
    const [rows] = await db.query(sql, [sale_id]);

    // Check if the sale was found
    if (rows.length === 0) {
      return res.status(404).json({ message: "Sale not found." });
    }

    // Return the found sale
    return res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching sale:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }
};





  
module.exports = {
    makesale,
    getsales,
    getsalebyid

  };
  

