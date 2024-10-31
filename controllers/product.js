const db = require("../config/db");
const cron = require('node-cron');
const nodemailer = require('nodemailer');

//add item
const additem = async (req, res) => {
  console.log("Request body", req.body);

  // Step 0: Check if the product_name exists in the request body
  if (!req.body.product_name) {
    return res.status(400).json({ message: "Product name is required." });
  }
  
  const checkProductQuery = `SELECT imei_number, product_stock, product_id, warranty_period FROM products WHERE product_name = ?`;
  const getStoreNameQuery = `SELECT s.store_name FROM users u JOIN stores s ON u.store_id = s.store_id WHERE u.user_id = ?`;

  try {
    const [store] = await db.query(getStoreNameQuery, [req.body.user]);

    if (store.length === 0) {
      return res.status(400).json({ message: "Store not found for the given user." });
    }

    const storeName = store[0].store_name;
    const [product] = await db.query(checkProductQuery, [req.body.product_name]);
    const newImeiNumbers = req.body.imei_numbers; // Assuming imei_numbers is an array in req.body

    if (product.length > 0) {
      const existingImeiNumbers = product[0].imei_number ? product[0].imei_number.split(",") : [];
      const duplicateImeiNumbers = newImeiNumbers.filter(imei => existingImeiNumbers.includes(imei));

      if (duplicateImeiNumbers.length > 0) {
        return res.status(400).json({ message: `The following IMEI numbers already exist: ${duplicateImeiNumbers.join(", ")}` });
      } else {
        const updatedImeiNumbers = [...existingImeiNumbers, ...newImeiNumbers].join(",");
        const updateProductQuery = `
          UPDATE products
          SET imei_number = ?, product_stock = product_stock + ?
          WHERE product_name = ?;
        `;
        await db.query(updateProductQuery, [updatedImeiNumbers, req.body.product_stock, req.body.product_name]);

        const checkStockQuery = `SELECT * FROM stock WHERE product_id = ? AND store_name = ?`;
        const [existingStock] = await db.query(checkStockQuery, [product[0].product_id, storeName]);

        if (existingStock.length > 0) {
          const updatedImeiNumbersInStock = existingStock[0].imei_numbers
            ? existingStock[0].imei_numbers.split(",").concat(newImeiNumbers).join(",")
            : newImeiNumbers.join(",");
          const updateStockQuery = `
            UPDATE stock
            SET stock_quantity = stock_quantity + ?, imei_numbers = ?
            WHERE product_id = ? AND store_name = ?
          `;
          await db.query(updateStockQuery, [
            req.body.product_stock,
            updatedImeiNumbersInStock,
            product[0].product_id,
            storeName,
          ]);
        } else {
          const insertStockQuery = `
            INSERT INTO stock (store_name, product_id, stock_quantity, imei_numbers)
            VALUES (?, ?, ?, ?)
          `;
          await db.query(insertStockQuery, [
            storeName,
            product[0].product_id,
            req.body.product_stock,
            newImeiNumbers.join(","),
          ]);
        }

        return res.status(200).json({
          message: "IMEI numbers added, product stock updated, and stock updated for the store.",
          updatedImeiNumbers,
        });
      }
    } else {
      const insertProductQuery = `
        INSERT INTO products (product_name, product_code, product_price, warranty_period, imei_number, product_stock, product_type, product_model, brand_name, product_wholesale_price, max_discount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const productValues = [
        req.body.product_name,
        req.body.product_code,
        req.body.product_price,
        req.body.warranty_period,
        newImeiNumbers.join(","), 
        req.body.product_stock,
        req.body.product_type,
        req.body.product_model,
        req.body.brand_name,
        req.body.product_wholesale_price,
        req.body.max_discount
      ];
      const [insertedProduct] = await db.query(insertProductQuery, productValues);
      
      const insertStockQuery = `
        INSERT INTO stock (store_name, product_id, stock_quantity, imei_numbers)
        VALUES (?, ?, ?, ?)
      `;
      await db.query(insertStockQuery, [
        storeName,
        insertedProduct.insertId,
        req.body.product_stock,
        newImeiNumbers.join(","),
      ]);
      
      console.log("Inserted Product ID:", insertedProduct.insertId);

      return res.status(200).json({
        message: "New product added successfully and stock updated for the store.",
      });
    }
  } catch (err) {
    console.error("Error adding Product:", err.message);
    return res.status(500).json({ message: "Error inside server.", err });
  }
};



// Get all distinct product types as an array
const getProductTypes = async (req, res) => {
  const sql = "SELECT DISTINCT product_type FROM products";
  
  try {
    console.log("Fetching product types...");
    const [rows] = await db.query(sql);

    // Map the result to an array of product types
    const productTypes = rows.map(row => row.product_type);

    return res.json(productTypes);
  } catch (err) {
    console.error("Error fetching product types:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }
}

// Get distinct brand names for a given product type
const getBrandsByProductType = async (req, res) => {
  const { product_type } = req.query; // Get product_type from request parameters
  const sql = "SELECT DISTINCT brand_name FROM products WHERE product_type = ?";

  try {
    console.log(`Fetching brand names for product type: ${product_type}...`);
    const [rows] = await db.query(sql, [product_type]);

    // Map the result to an array of brand names
    const brandNames = rows.map(row => row.brand_name);

    return res.json(brandNames);
  } catch (err) {
    console.error("Error fetching brand names:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }
}

const getFilteredProductDetails = async (req, res) => {
  const { product_name, store_name, brand_name, product_type } = req.body;

  try {
    console.log("Fetching all product details...");
    // Fetch all products and stock data from the database
    const [rows] = await db.query(`
      SELECT p.*, s.store_name, s.stock_quantity, s.imei_numbers
      FROM products p 
      JOIN stock s ON p.product_id = s.product_id
    `);

    console.log("Applying filters...");

    // Apply .filter() based on conditions
    const filteredProducts = rows.filter((product) => {
      return (
        (!product_name || product_name === "All" || product.product_name.toLowerCase().includes(product_name.toLowerCase())) &&
        (!store_name || store_name === "All" || product.store_name.toLowerCase().includes(store_name.toLowerCase())) &&
        (!brand_name || brand_name === "All" || product.brand_name.toLowerCase().includes(brand_name.toLowerCase())) &&
        (!product_type || product_type === "All" || product.product_type.toLowerCase().includes(product_type.toLowerCase()))
      );
    });

   // console.log("Filtered products:", filteredProducts);
    console.log("rhtrh",store_name);
    return res.json(filteredProducts);
  } catch (err) {
    console.error("Error fetching product details:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }
};





// Get all products by brand name and product type
const getProductModelsByBrandName = async (req, res) => {
  const { brand_name, product_type } = req.query; // Get brand_name and product_type from request query parameters
  const sql = `
    SELECT 
      products.*, 
      GROUP_CONCAT(sales_items.imei_number) AS imei_numbers
    FROM products
    LEFT JOIN sales_items ON products.product_id = sales_items.product_id
    WHERE products.brand_name = ? AND products.product_type = ?
    GROUP BY products.product_id;`;

  try {
    console.log(`Fetching products for brand: ${brand_name} and product type: ${product_type}...`);
    const [rows] = await db.query(sql, [brand_name, product_type]);

    // Process the rows to convert the concatenated IMEI numbers into an array
    const processedRows = rows.map(row => {
      const imeiArray = row.imei_number ? row.imei_number.split(',') : [];
      
      // Return a new object without the imei_numbers field
      const { imei_number, ...rest } = row;

      return {
        ...rest,
        imei_number: imeiArray // Replace imei_number with the array
      };
    });

    // Return all product details with IMEI numbers as an array
    return res.json(processedRows);
  } catch (err) {
    console.error("Error fetching products:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }
};


const searchProductsByName = async (req, res) => {
  const { searchText } = req.query; // Get the search text from the query parameters

  if (!searchText) {
    return res.status(400).json({ message: "Search text is required." });
  }

  const sql = "SELECT product_name FROM products WHERE product_name LIKE ?";

  try {
    // Execute the SQL query
    const [rows] = await db.query(sql, [`%${searchText}%`]);

    // Check if any products are found
    if (rows.length === 0) {
      return res.status(404).json({ message: "No products found." });
    }

    // Map the result to extract only product names
    const productNames = rows.map(row => row.product_name);

    // Return the product names as an array
    return res.json(productNames);
  } catch (err) {
    console.error("Error fetching products:", err.message);
    return res.status(500).json({ message: "Error inside server during product search.", err });
  }
};


const searchProductsByType = async (req, res) => {
  const { searchText } = req.query; // Get the search text from the query parameters

  if (!searchText) {
    return res.status(400).json({ message: "Search text is required." });
  }

  const sql = "SELECT DISTINCT product_type FROM products WHERE product_type LIKE ?";

  try {
    // Execute the SQL query
    const [rows] = await db.query(sql, [`%${searchText}%`]);

    // Check if any product types are found
    if (rows.length === 0) {
      return res.status(404).json({ message: "No product types found." });
    }

    // Map the result to extract only product types
    const productTypes = rows.map(row => row.product_type);

    // Return the product types as an array
    return res.json(productTypes);
  } catch (err) {
    console.error("Error fetching product types:", err.message);
    return res.status(500).json({ message: "Error inside server during product type search.", err });
  }
};



const searchProductsByModel = async (req, res) => {
  const { searchText } = req.query; // Get the search text from the query parameters
  console.log(searchText);
  
  if (!searchText) {
    return res.status(400).json({ message: "Search text is required." });
  }

  const sql = "SELECT DISTINCT product_model FROM products WHERE product_model LIKE ?";

  try {
    // Execute the SQL query
    const [rows] = await db.query(sql, [`%${searchText}%`]);

    // Check if any product models are found
    if (rows.length === 0) {
      return res.status(404).json({ message: "No product models found." });
    }

    // Map the result to extract only product models
    const productModels = rows.map(row => row.product_model);

    // Return the product models as an array
    return res.json(productModels);
  } catch (err) {
    console.error("Error fetching product models:", err.message);
    return res.status(500).json({ message: "Error inside server during product model search.", err });
  }
};





const searchProductsByBrand = async (req, res) => {
  const { searchText } = req.query; // Get the search text from the query parameters
console.log(searchText);
  if (!searchText) {
    return res.status(400).json({ message: "Search text is required." });
  }

  const sql = "SELECT DISTINCT brand_name FROM products WHERE brand_name LIKE ?";

  try {
    // Execute the SQL query
    const [rows] = await db.query(sql, [`%${searchText}%`]);

    // Check if any brand names are found
    if (rows.length === 0) {
      return res.status(404).json({ message: "No brand names found." });
    }

    // Map the result to extract only brand names
    const brandNames = rows.map(row => row.brand_name);

    // Return the brand names as an array
    return res.json(brandNames);
  } catch (err) {
    console.error("Error fetching brand names:", err.message);
    return res.status(500).json({ message: "Error inside server during brand name search.", err });
  }
};








//get all items
const getitems = async (req,res)=>{
    const sql = "SELECT * FROM products";
  
  try {
    console.log("get products");
    const [rows] = await db.query(sql);
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching products:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }

}


//get item
const getitembyid = async (req,res) =>{
    const product_name = req.params.product_name; 

    const sql = `
        SELECT *
        FROM products
        WHERE product_name = ?`;
    
        try {
            console.log("Fetching product by ID:", product_name);
            
            const [rows] = await db.query(sql, [product_name]); // Pass the product ID as a parameter to the query
        
            if (rows.length === 0) {
              return res.status(404).json({ message: "Product not found." }); // Handle case where no product is found
            }
        console.log(rows);
            return res.json(rows[0]); // Return the found product
          } catch (err) {
            console.error("Error fetching product:", err.message);
            return res.status(500).json({ message: "Error inside server", err });
          }

}


const getitembyname = async (req, res) => {
  const product_name = req.params.product_name;

  const sql = `
  SELECT product_id, product_name
        FROM products
        WHERE product_name LIKE ?`;

  try {
      console.log("Fetching product by name:", product_name);

      const [rows] = await db.query(sql, `%${product_name}%`); // Pass the product name as a parameter to the query

      if (rows.length === 0) {
          return res.status(404).json({ message: "Product not found." }); // Handle case where no product is found
      }
      
      console.log(rows);
      return res.json(rows); // Return the found product
  } catch (err) {
      console.error("Error fetching product:", err.message);
      return res.status(500).json({ message: "Error inside server", err });
  }
};



//get item by code
const getitembycode = async (req,res) =>{
  const product_code = req.params.product_code; 

  const sql = `
       SELECT 
      product_id, 
      product_name, 
      product_code, 
      product_price, 
      warranty_period, 
      product_stock, 
      product_type, 
      brand_name, 
      product_model
    FROM 
      products
    WHERE 
      product_code = ?;`;
  
      try {
          console.log("Fetching product by ID:", product_code);
          
          const [rows] = await db.query(sql, [product_code]); // Pass the product ID as a parameter to the query
      
          if (rows.length === 0) {
            return res.status(404).json({ message: "Product not found." }); // Handle case where no product is found
          }
      console.log(rows);
          return res.json(rows[0]); // Return the found product
        } catch (err) {
          console.error("Error fetching product:", err.message);
          return res.status(500).json({ message: "Error inside server", err });
        }

}



//update item
const updateitem = async (req,res) =>{
    console.log("Request body:", req.body); // Log the request body

    const sql = `
      UPDATE products 
      SET product_name=? , product_price=?  , warranty_period=? , product_type =? , brand_name =? , product_wholesale_price =? ,max_discount=?
      WHERE product_name = ?
    `;
  
    const product_name = req.params.product_name; 
  
    const values = [
      req.body.product_name,
      req.body.product_price,
      req.body.warranty_period,
      // req.body.imei_number,
      // req.body.product_stock,
      req.body.product_type,
      req.body.brand_name,
      req.body.product_wholesale_price,
      req.body.max_discount,
      product_name

    ];
  
    try {
      const [result] = await db.query(sql, values); 
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Product not found." }); 
      }
      return res.status(200).json({ message: "Product updated successfully.", result });
    } catch (err) {
      console.error("Error updating Product:", err.message); // Log any error messages
      return res.status(500).json({ message: "Error inside server.", err });
    }
};

//delete item
const deleteitem = async (req, res) => {
  const product_name = req.params.product_name;

  // SQL queries
  const getProductIdQuery = "SELECT product_id FROM products WHERE product_name = ?;";
  const deleteStockQuery = "DELETE FROM stock WHERE product_id = ?;";
  const deleteProductQuery = "DELETE FROM products WHERE product_name = ?;";

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    console.log("Deleting product and its stock:", product_name);

    // Get product_id for the given product name
    const [productRows] = await connection.query(getProductIdQuery, [product_name]);
    if (productRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Product not found" });
    }

    const product_id = productRows[0].product_id;

    // Delete stock records associated with this product_id
    const [stockResult] = await connection.query(deleteStockQuery, [product_id]);

    // Delete the product itself from the products table
    const [productResult] = await connection.query(deleteProductQuery, [product_name]);

    // Commit transaction if both deletions succeed
    await connection.commit();

    return res.json({
      message: "Product and associated stock deleted successfully",
      deletedStockRecords: stockResult.affectedRows,
      deletedProductRecords: productResult.affectedRows,
    });
  } catch (err) {
    // Rollback transaction in case of error
    await connection.rollback();
    console.error("Error deleting product and stock:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  } finally {
    // Release the connection back to the pool
    connection.release();
  }
};



const updateStockAndIMEI = async (req, res) => {
  console.log("Request body:", req.body); // Log the request body

  // SQL queries for fetching and updating the product in `products` table
  const sqlSelectProduct = `
    SELECT product_stock, imei_number, product_id
    FROM products 
    WHERE product_name = ?
  `;

  const sqlUpdateProduct = `
    UPDATE products 
    SET product_stock = ?, imei_number = ?
    WHERE product_name = ?
  `;

  // SQL queries for fetching and updating the stock in `stock` table
  const sqlSelectStock = `
    SELECT stock_quantity, imei_numbers 
    FROM stock 
    WHERE product_id = ? AND store_name = ?
  `;

  const sqlUpdateStock = `
    UPDATE stock 
    SET stock_quantity = ?, imei_numbers = ?
    WHERE product_id = ? AND store_name = ?
  `;

  const { product_name } = req.params; // Extract product_name from the request URL
  const { product_stock, imei_number, user } = req.body; // Extract new stock and IMEI numbers
  const getStoreNameQuery = `SELECT s.store_name FROM users u JOIN stores s ON u.store_id = s.store_id WHERE u.user_id = ?`;

  try {
    // Step 1: Fetch store_name for the user
    const [store] = await db.query(getStoreNameQuery, [user]);
    if (store.length === 0) {
      return res.status(400).json({ message: "Store not found for the given user." });
    }
    const storeName = store[0].store_name;

    // Step 2: Fetch existing stock and IMEI numbers from products table
    const [product] = await db.query(sqlSelectProduct, [product_name]);
    if (product.length === 0) {
      return res.status(404).json({ message: "Product not found." });
    }

    let currentStock = Number(product[0].product_stock);
    let currentIMEINumbers = product[0].imei_number ? product[0].imei_number.split(",") : [];
    const productId = product[0].product_id;

    // Step 3: Merge new IMEI numbers with existing ones
    const newIMEINumbers = Array.isArray(imei_number) ? imei_number : [imei_number];
    const updatedIMEINumbers = [...currentIMEINumbers, ...newIMEINumbers].join(",");

    // Step 4: Update stock in products table by adding new quantity
    const updatedStock = currentStock + Number(product_stock);
    await db.query(sqlUpdateProduct, [updatedStock, updatedIMEINumbers, product_name]);

    // Step 5: Fetch current stock data for the store from stock table
    const [stock] = await db.query(sqlSelectStock, [productId, storeName]);
    if (stock.length > 0) {
      // Stock entry exists for this store, so update the record
      let currentStockQuantity = Number(stock[0].stock_quantity);
      let existingIMEINumbersInStock = stock[0].imei_numbers ? stock[0].imei_numbers.split(",") : [];

      // Merge IMEI numbers and update stock quantity
      const updatedStockQuantityInStore = currentStockQuantity + Number(product_stock);
      const updatedIMEINumbersInStore = [...existingIMEINumbersInStock, ...newIMEINumbers].join(",");

      await db.query(sqlUpdateStock, [
        updatedStockQuantityInStore,
        updatedIMEINumbersInStore,
        productId,
        storeName,
      ]);
    } else {
      // No stock entry for this product/store, insert a new record
      const sqlInsertStock = `
        INSERT INTO stock (store_name, product_id, stock_quantity, imei_numbers)
        VALUES (?, ?, ?, ?)
      `;
      await db.query(sqlInsertStock, [
        storeName,
        productId,
        product_stock,
        newIMEINumbers.join(","),
      ]);
    }

    return res.status(200).json({ message: "Stock and IMEI numbers updated successfully in both products and stock tables." });

  } catch (err) {
    console.error("Error updating Product and Stock:", err.message); // Log any error messages
    return res.status(500).json({ message: "Error inside server.", err });
  }
};

const getProductDetails = async (req, res) => {
  const { imei_number } = req.query;
  console.log(imei_number);

  if (!imei_number) {
    return res.status(400).json({ message: 'Please provide a valid imei_number' });
  }

  try {
    // Step 1: Check if the product exists in the 'products' table (not yet sold)
    const productQuery = `
      SELECT 
        p.product_id,
        p.product_name,
        p.product_price,
        p.product_type,
        p.brand_name,
        s.store_name,
        p.created_at AS date
      FROM products p
      INNER JOIN stock s ON p.product_id = s.product_id
      WHERE FIND_IN_SET(?, p.imei_number) > 0;
    `;

    const [products] = await db.query(productQuery, [imei_number]);

    if (products.length > 0) {
      // Product is in stock, return the details with sold = false and transfer = false by default
      let productDetails = { ...products[0], sold: false, transfer: false };

      // Check if the product is also in the transfer table
      const transferQuery = `
        SELECT transfer_to 
        FROM transfer 
        WHERE FIND_IN_SET(?, imei_number) > 0 
          AND transfer_approval = 'sending';
      `;
      const [transfers] = await db.query(transferQuery, [imei_number]);

      if (transfers.length > 0) {
        // IMEI is in the transfer table with status "sending"
        productDetails.transfer = true;
        productDetails.transfer_to = transfers[0].transfer_to;
      }

      return res.status(200).json(productDetails);
    }

    // Step 2: If not found in 'products', check if it exists in 'sales_items' (sold)
    const soldQuery = `
      SELECT 
        p.product_id,
        p.product_name,
        p.product_price,
        p.product_type,
        p.brand_name,
        si.created_at AS date
      FROM products p
      INNER JOIN sales_items si ON p.product_id = si.product_id
      WHERE FIND_IN_SET(?, si.imei_number) > 0;
    `;

    const [soldProducts] = await db.query(soldQuery, [imei_number]);

    if (soldProducts.length > 0) {
      // Product has been sold, return the details with sold = true and transfer = false
      return res.status(200).json({
        ...soldProducts[0],
        sold: true,
        transfer: false
      });
    }

    // Step 3: If not found in both tables, return a 404 response
    return res.status(404).json({ message: 'Product not found' });

  } catch (err) {
    console.error('Error fetching product details:', err.message);
    return res.status(500).json({ message: 'Error inside server while fetching product details', err });
  }
};


// Set up nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // Use your email service provider
      host: "smtp.gmail.email",
      port: 465,
      secure: true, // true for port 465, false for other ports    
      auth: {
          user:  process.env.EMAIL,
          pass: process.env.EMAIL_PASS , // Use environment variables for sensitive data
      },
});

// Function to get low stock items and send email
const sendLowStockEmail = async () => {
  try {
    // Query to get items with stock quantity <= 10
    const lowStockQuery = `
      SELECT 
        s.store_name,
        p.product_name,
        s.stock_quantity
      FROM stock s
      INNER JOIN products p ON s.product_id = p.product_id
      WHERE s.stock_quantity <= 10;
    `;
    
    const [lowStockItems] = await db.query(lowStockQuery);

    if (lowStockItems.length === 0) {
      console.log('No low stock items found.');
      return;
    }

    // Format the low stock items for the email
    const lowStockList = lowStockItems.map(item => 
      `Store: ${item.store_name}, Product: ${item.product_name}, Quantity: ${item.stock_quantity}`
    ).join('\n');

    // Email options
    const mailOptions = {
      from: process.env.EMAIL,
      to: process.env.recipientEmail,
      subject: 'Daily Low Stock Alert',
      text: `The following items have low stock (10 or less):\n\n${lowStockList}`
    };

    // Send the email
    await transporter.sendMail(mailOptions);
    console.log('Low stock email sent successfully!');
  } catch (error) {
    console.error('Error sending low stock email:', error);
  }
};

// Schedule the task to run daily at 9:00 AM
cron.schedule('8 23 * * *', () => {
  console.log('Checking low stock items and sending email...');
  sendLowStockEmail();
});




module.exports = {
    additem,
    getitembyid,
    getitems,
    updateitem,
    deleteitem,
    getProductTypes,
    getBrandsByProductType,
    getProductModelsByBrandName,
    getFilteredProductDetails,
    searchProductsByName,
    searchProductsByBrand,
    searchProductsByType,
    searchProductsByModel,
    updateStockAndIMEI,
    getProductDetails,
    getitembycode,
    getitembyname
  };
  

  /*
  imei number to fetch from an array

  SELECT * FROM products
  WHERE FIND_IN_SET('12345', imei_number);
changes can be made if wanted

  */ 