const db = require("../config/db");
const cron = require("node-cron");
const nodemailer = require("nodemailer");

//add item
const additem = async (req, res) => {
  // Step 0: Check if the product_name exists in the request body
  if (!req.body.product_name) {
    return res.status(400).json({ message: "Product name is required." });
  }
  const checkProductcodeQuery = `
  SELECT imei_number, product_stock, product_id, warranty_period 
  FROM products 
  WHERE product_code = ?
`;
  const checkProductQuery = `SELECT imei_number, product_stock, product_id, warranty_period FROM products WHERE product_name = ?`;
  const getStoreNameQuery = `SELECT s.store_name FROM users u JOIN stores s ON u.store_id = s.store_id WHERE u.user_id = ?`;

  try {
      // Step 2: Check if the product_code already exists
      const [existingProduct] = await db.query(checkProductcodeQuery, [req.body.product_code]);
      if (existingProduct.length > 0) {
        throw new Error("Product code is already in use.");
      }
    const [store] = await db.query(getStoreNameQuery, [req.body.user]);

    if (store.length === 0) {
      return res
        .status(400)
        .json({ message: "Store not found for the given user." });
    }

    const storeName = store[0].store_name;
    const [product] = await db.query(checkProductQuery, [
      req.body.product_name,
    ]);
    const newImeiNumbers = req.body.imei_numbers; // Assuming imei_numbers is an array in req.body

    const insertProductQuery = `
        INSERT INTO products (product_name, product_code, product_price, warranty_period, imei_number, product_stock, product_type, product_model, brand_name, product_wholesale_price, max_discount, color, capacity, low_count, grade)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      req.body.max_discount,
      req.body.color, // New field: color
      req.body.capacity, // New field: capacity
      req.body.low_count || 0, // New field: low_count (defaults to 0 if not provided)
      req.body.grade, // New field: grade
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

    return res.status(200).json({
      message:
        "New product added successfully and stock updated for the store.",
    });
  } catch (err) {
        // Handle known errors differently
        if (err.message === "Product code is already in use.") {
          return res.status(400).json({ message: err.message }); // Return specific error message
        }
    
        // Handle generic errors
        console.error("Error adding Product:", err.message);
        return res.status(500).json({ 
          message: "Error inside server.", 
          error: err.message 
        });
    
  }
};

// Get all distinct product types as an array
const getProductTypes = async (req, res) => {
  const sql = "SELECT DISTINCT product_type FROM products";

  try {
    const [rows] = await db.query(sql);

    // Map the result to an array of product types
    const productTypes = rows.map((row) => row.product_type);

    return res.json(productTypes);
  } catch (err) {
    console.error("Error fetching product types:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }
};
// Get all distinct product types as an array
const getProductcolor = async (req, res) => {
  const sql = "SELECT DISTINCT color FROM products";

  try {
    const [rows] = await db.query(sql);

    // Map the result to an array of product types
    const color = rows.map((row) => row.color);
    return res.json(color);
  } catch (err) {
    // console.error("Error fetching product types:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }
};


// Get all distinct product types as an array
const getProductCapacity = async (req, res) => {
  const sql = "SELECT DISTINCT capacity FROM products";

  try {
    const [rows] = await db.query(sql);

    // Map the result to an array of product types
    const capacity = rows.map((row) => row.capacity);
    return res.json(capacity);
  } catch (err) {
    // console.error("Error fetching product types:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }
};

// Get distinct brand names for a given product type
const getBrandsByProductType = async (req, res) => {
  const { product_type } = req.query; // Get product_type from request parameters
  const sql = "SELECT DISTINCT brand_name FROM products WHERE product_type = ?";

  try {
    const [rows] = await db.query(sql, [product_type]);

    // Map the result to an array of brand names
    const brandNames = rows.map((row) => row.brand_name);

    return res.json(brandNames);
  } catch (err) {
    console.error("Error fetching brand names:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }
};

const getFilteredProductDetails = async (req, res) => {
  const {
    product_name,
    store_name,
    brand_name,
    product_type,
    store_id,
    color,
    capacity,
    grade,
  } = req.body;

  try {
    let resolvedStoreName = store_name;

    // Check if `store_id` is provided and fetch `store_name` if needed
    if (store_id) {
      const sql = `
        SELECT store_name
        FROM stores
        WHERE store_id = ?
      `;
      const [storeResult] = await db.query(sql, [store_id]);

      if (storeResult.length > 0) {
        resolvedStoreName = storeResult[0].store_name;
      } else {
        return res.status(404).json({ message: "Store not found" });
      }
    }

    // Fetch all products and stock data from the database
    const [rows] = await db.query(`
      SELECT p.*, s.store_name, s.stock_quantity, s.imei_numbers
      FROM products p 
      JOIN stock s ON p.product_id = s.product_id
    `);

    // Apply .filter() based on conditions, including the new columns
    const filteredProducts = rows.filter((product) => {
      const matchesProductNameOrCode =
      (!product_name ||
        product_name === "All" ||
        (product.product_name &&
          product.product_name
            .toLowerCase()
            .includes(product_name.toLowerCase())) ||
        (product.product_code &&
          product.product_code
            .toLowerCase()
            .includes(product_name.toLowerCase())));
      return (
        matchesProductNameOrCode &&
        (!resolvedStoreName ||
          resolvedStoreName === "All" ||
          (product.store_name &&
            product.store_name
              .toLowerCase()
              .includes(resolvedStoreName.toLowerCase()))) &&
        (!brand_name ||
          brand_name === "All" ||
          (product.brand_name &&
            product.brand_name
              .toLowerCase()
              .includes(brand_name.toLowerCase()))) &&
        (!product_type ||
          product_type === "All" ||
          (product.product_type &&
            product.product_type
              .toLowerCase()
              .includes(product_type.toLowerCase()))) &&
        (!color ||
          color === "All" ||
          (product.color &&
            product.color.toLowerCase().includes(color.toLowerCase()))) &&
        (!capacity ||
          capacity === "All" ||
          (product.capacity &&
            product.capacity.toLowerCase().includes(capacity.toLowerCase()))) &&
        (!grade ||
          grade === "All" ||
          (product.grade &&
            product.grade.toLowerCase().includes(grade.toLowerCase())))
      );
    });
    return res.json(filteredProducts);
  } catch (err) {
    console.error("Error fetching product details:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }
};

// Get all products by brand name and product type
const getProductforMangerinventory = async (req, res) => {
  const { brand_name, product_type, store_id } = req.query; // Get brand_name, product_type, and store_id from request query parameters

  try {
    // Build dynamic conditions for brand_name and product_type
    let whereConditions = [];
    let queryParams = [];

    if (brand_name && brand_name !== "All") {
      whereConditions.push(`products.brand_name = ?`);
      queryParams.push(brand_name);
    }
    if (product_type && product_type !== "All") {
      whereConditions.push(`products.product_type = ?`);
      queryParams.push(product_type);
    }

    // Construct the WHERE clause dynamically
    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(" AND ")}`
      : "";

    const productQuery = `
      SELECT 
        products.*,
        GROUP_CONCAT(sales_items.imei_number) AS imei_numbers
      FROM products
      LEFT JOIN sales_items ON products.product_id = sales_items.product_id
      ${whereClause}
      GROUP BY products.product_id;`;

    // Query products and IMEI numbers
    const [productRows] = await db.query(productQuery, queryParams);

    // Query to get the store name
    const storeQuery = `SELECT store_name FROM stores WHERE store_id = ?;`;
    const [storeRows] = await db.query(storeQuery, [store_id]);
    const storeName = storeRows.length > 0 ? storeRows[0].store_name : null;

    // Process each product row and get stock quantity
    const processedRows = await Promise.all(
      productRows.map(async (row) => {
        const imeiArray = row.imei_numbers ? row.imei_numbers.split(",") : [];

        // Get stock quantity for the current product
        const stockQuery = `SELECT stock_quantity FROM stock WHERE product_id = ? AND store_name = ?;`;
        const [stockRows] = await db.query(stockQuery, [
          row.product_id,
          storeName,
        ]);
        const stockQuantity =
          stockRows.length > 0 ? stockRows[0].stock_quantity : 0;

        // Return product data with IMEI numbers as an array and stock quantity
        return {
          ...row,
          imei_numbers: imeiArray,
          stock_quantity: stockQuantity,
        };
      })
    );

    // Return all processed product details with IMEI numbers as arrays and stock quantities
    return res.json(processedRows);
  } catch (err) {
    console.error("Error fetching products:", err.message);
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
    const [rows] = await db.query(sql, [brand_name, product_type]);

    // Process the rows to convert the concatenated IMEI numbers into an array
    const processedRows = rows.map((row) => {
      const imeiArray = row.imei_number ? row.imei_number.split(",") : [];

      // Return a new object without the imei_numbers field
      const { imei_number, ...rest } = row;

      return {
        ...rest,
        imei_number: imeiArray, // Replace imei_number with the array
      };
    });

    // Return all product details with IMEI numbers as an array
    return res.json(processedRows);
  } catch (err) {
    console.error("Error fetching products:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }
};



const getProductModelsByBrandNameStoreName = async (req, res) => {
  const { brand_name, product_type, store_name } = req.query; // Get parameters from query
  
  // SQL query to get product IDs for the store
  const productIdsSql = `
    SELECT product_id 
    FROM stock 
    INNER JOIN stores ON stock.store_name = stores.store_name
    WHERE stores.store_name = ?;
  `;

  // SQL query to fetch product details filtered by product IDs, brand_name, and product_type
  const productsSql = `
    SELECT 
      products.*, 
      GROUP_CONCAT(sales_items.imei_number) AS imei_numbers
    FROM products
    LEFT JOIN sales_items ON products.product_id = sales_items.product_id
    WHERE products.product_id IN (?) 
      AND products.brand_name = ? 
      AND products.product_type = ?
    GROUP BY products.product_id;
  `;

  try {
    // Step 1: Fetch product IDs for the specified store
    const [productRows] = await db.query(productIdsSql, [store_name]);
    const productIds = productRows.map(row => row.product_id);

    if (productIds.length === 0) {
      // If no product IDs are found for the store, return an empty response
      return res.json([]);
    }

    // Step 2: Fetch product details using the product IDs, brand_name, and product_type
    const [rows] = await db.query(productsSql, [productIds, brand_name, product_type]);

    // Step 3: Process the rows to convert concatenated IMEI numbers into an array
    const processedRows = rows.map(row => {
      const imeiArray = row.imei_numbers ? row.imei_numbers.split(",") : [];
      const { imei_numbers, ...rest } = row; // Remove imei_numbers field

      return {
        ...rest,
        imei_numbers: imeiArray, // Replace with array format
      };
    });

    // Step 4: Return processed data
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
    const productNames = rows.map((row) => row.product_name);

    // Return the product names as an array
    return res.json(productNames);
  } catch (err) {
    console.error("Error fetching products:", err.message);
    return res
      .status(500)
      .json({ message: "Error inside server during product search.", err });
  }
};

const getImeiNumbers = async (req, res) => {
  const { shop, Product_id } = req.body; // Get the store name and product ID from the request body
  const sql = `
    SELECT imei_numbers 
    FROM stock 
    WHERE store_name = ? AND product_id = ?
  `;

  try {
    // Execute the SQL query with the provided parameters
    const [rows] = await db.query(sql, [shop, Product_id]);

    // Check if any stock entries are found
    if (rows.length === 0) {
      return res.status(404).json({
        message: "No IMEI numbers found for the given store and product ID.",
      });
    }

    // Map the result to extract IMEI numbers
    const imeiNumbers = rows.map((row) => row.imei_numbers);

    // Return the IMEI numbers as an array
    return res.json(imeiNumbers);
  } catch (err) {
    console.error("Error fetching IMEI numbers:", err.message);
    return res
      .status(500)
      .json({ message: "Error inside server during IMEI number search.", err });
  }
};

const searchProductsByType = async (req, res) => {
  const { searchText } = req.query; // Get the search text from the query parameters

  if (!searchText) {
    return res.status(400).json({ message: "Search text is required." });
  }

  const sql =
    "SELECT DISTINCT product_type FROM products WHERE product_type LIKE ?";

  try {
    // Execute the SQL query
    const [rows] = await db.query(sql, [`%${searchText}%`]);

    // Check if any product types are found
    if (rows.length === 0) {
      return res.status(404).json({ message: "No product types found." });
    }

    // Map the result to extract only product types
    const productTypes = rows.map((row) => row.product_type);

    // Return the product types as an array
    return res.json(productTypes);
  } catch (err) {
    console.error("Error fetching product types:", err.message);
    return res.status(500).json({
      message: "Error inside server during product type search.",
      err,
    });
  }
};

const searchProductsByModel = async (req, res) => {
  const { searchText } = req.query; // Get the search text from the query parameters

  if (!searchText) {
    return res.status(400).json({ message: "Search text is required." });
  }

  const sql =
    "SELECT DISTINCT product_model FROM products WHERE product_model LIKE ?";

  try {
    // Execute the SQL query
    const [rows] = await db.query(sql, [`%${searchText}%`]);

    // Check if any product models are found
    if (rows.length === 0) {
      return res.status(404).json({ message: "No product models found." });
    }

    // Map the result to extract only product models
    const productModels = rows.map((row) => row.product_model);

    // Return the product models as an array
    return res.json(productModels);
  } catch (err) {
    console.error("Error fetching product models:", err.message);
    return res.status(500).json({
      message: "Error inside server during product model search.",
      err,
    });
  }
};

const searchProductsByBrand = async (req, res) => {
  const { searchText } = req.query; // Get the search text from the query parameters
  if (!searchText) {
    return res.status(400).json({ message: "Search text is required." });
  }

  const sql =
    "SELECT DISTINCT brand_name FROM products WHERE brand_name LIKE ?";

  try {
    // Execute the SQL query
    const [rows] = await db.query(sql, [`%${searchText}%`]);

    // Check if any brand names are found
    if (rows.length === 0) {
      return res.status(404).json({ message: "No brand names found." });
    }

    // Map the result to extract only brand names
    const brandNames = rows.map((row) => row.brand_name);

    // Return the brand names as an array
    return res.json(brandNames);
  } catch (err) {
    console.error("Error fetching brand names:", err.message);
    return res
      .status(500)
      .json({ message: "Error inside server during brand name search.", err });
  }
};

//get all items
const getitems = async (req, res) => {
  const sql = "SELECT * FROM products";

  try {
    const [rows] = await db.query(sql);
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching products:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }
};

//get item
const getproductbycode = async (req, res) => {
  const product_code = req.params.product_code;
  console.log(product_code);

  const sql = `
        SELECT *
        FROM products
        WHERE product_code = ?`;

  try {
    const [rows] = await db.query(sql, [product_code ]); // Pass the product ID as a parameter to the query

    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found." }); // Handle case where no product is found
    }
    return res.json(rows[0]); // Return the found product
  } catch (err) {
    console.error("Error fetching product:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }
};

//get item
const getitembyid = async (req, res) => {
  const product_id = req.params.product_id;

  const sql = `
        SELECT *
        FROM products
        WHERE product_id = ?`;

  try {
    const [rows] = await db.query(sql, [product_id]); // Pass the product ID as a parameter to the query

    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found." }); // Handle case where no product is found
    }
    return res.json(rows[0]); // Return the found product
  } catch (err) {
    console.error("Error fetching product:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }
};

const getProductDetailsByID = async (req, res) => {
  const { product_id } = req.body;

  if (!product_id) {
    return res.status(400).json({ message: "Product ID is required." });
  }

  try {
    // Query to get product details using product_id
    const productQuery = `
      SELECT product_code FROM products
      WHERE product_id = ?;
    `;

    const [product_code] = await db.query(productQuery, [product_id]);

    if (product_code  .length === 0) {
      return res.status(404).json({ message: "Product not found." });
    }

    // Return product details
    return res.status(200).json(product_code[0]);
  } catch (err) {
    console.error("Error fetching product details:", err.message);
    return res.status(500).json({
      message: "Error inside server during fetching product details.",
      err,
    });
  }
};

const getitembyname = async (req, res) => {
  const product_name = req.params.product_name;

  const sql = `
  SELECT product_id, product_name
        FROM products
        WHERE product_name LIKE ?`;

  try {
    const [rows] = await db.query(sql, `%${product_name}%`); // Pass the product name as a parameter to the query

    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found." }); // Handle case where no product is found
    }
    return res.json(rows); // Return the found product
  } catch (err) {
    console.error("Error fetching product:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }
};

const getitembetails = async (req, res) => {
  const product_name = req.params.product_name;

  const sql = `
  SELECT product_id, product_name ,color,capacity,grade
        FROM products
        WHERE product_name LIKE ?`;

  try {
    const [rows] = await db.query(sql, `%${product_name}%`); // Pass the product name as a parameter to the query

    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found." }); // Handle case where no product is found
    }
    return res.json(rows); // Return the found product
  } catch (err) {
    console.error("Error fetching product:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }
};





//get item by code
const getitembycode = async (req, res) => {
  const { product_code, store_name } = req.params; // Assume store_name is passed as a parameter
  try {
    // Step 1: Get product IDs for the specified store
    const productIdsQuery = `
      SELECT product_id 
      FROM stock 
      INNER JOIN stores ON stock.store_name = stores.store_name
      WHERE stores.store_name = ?;
    `;

    const [productRows] = await db.query(productIdsQuery, [store_name]);
    const productIds = productRows.map(row => row.product_id);

    if (productIds.length === 0) {
      // No products found for the store
      return res.status(404).json({ message: "No products found for this store." });
    }

    // Step 2: Query for product details using product code or IMEI number
    let productQuery = `
      SELECT * 
      FROM products 
      WHERE product_id IN (?) 
        AND product_code = ?;
    `;
    let [productDetails] = await db.query(productQuery, [productIds, product_code]);

    // If no products match the product code, search for IMEI number
    if (productDetails.length === 0) {
      productQuery = `
        SELECT * 
        FROM products 
        WHERE product_id IN (?) 
          AND FIND_IN_SET(?, imei_number) > 0;
      `;
      [productDetails] = await db.query(productQuery, [productIds, product_code]);
    }

    if (productDetails.length === 0) {
      // If no data is found, return a 404 response
      return res.status(404).json({ message: "Product not found." });
    }

    // Step 3: Return the product details
    return res.status(200).json(productDetails[0]);
  } catch (err) {
    console.error("Error fetching product details:", err.message);
    return res.status(500).json({
      message: "Error inside server during fetching product details.",
      err,
    });
  }
};

//update item
const updateitem = async (req, res) => {
  const sql = `
    UPDATE products 
    SET product_name = ?,
        product_code = ?,
        product_price = ?, 
        warranty_period = ?, 
        product_type = ?, 
        brand_name = ?, 
        product_wholesale_price = ?, 
        max_discount = ?, 
        color = ?, 
        grade = ?, 
        capacity = ?,
        low_count=?
    WHERE product_id = ?
  `;

  const product_id = req.params.product_id;

  const values = [
    req.body.product_name,
    req.body.product_code,
    req.body.product_price,
    req.body.warranty_period,
    req.body.product_type,
    req.body.brand_name,
    req.body.product_wholesale_price,
    req.body.max_discount,
    req.body.color, // new column
    req.body.grade, // new column
    req.body.capacity, // new column
    req.body.low_count,
    product_id,
  ];

  try {
    const [result] = await db.query(sql, values);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Product not found." });
    }
    return res
      .status(200)
      .json({ message: "Product updated successfully.", result });
  } catch (err) {
    console.error("Error updating Product:", err.message); // Log any error messages
    return res.status(500).json({ message: "Error inside server.", err });
  }
};

//delete item
const deleteitem = async (req, res) => {
  const product_id = req.params.product_id;

  // SQL queries
  
  const deleteStockQuery = "DELETE FROM stock WHERE product_id = ?;";
  const deleteProductQuery = "DELETE FROM products WHERE product_id = ?;";

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {

    // Delete stock records associated with this product_id
    const [stockResult] = await connection.query(deleteStockQuery, [
      product_id,
    ]);

    // Delete the product itself from the products table
    const [productResult] = await connection.query(deleteProductQuery, [
      product_id,
    ]);

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
  // SQL queries for fetching and updating the product in `products` table
  const sqlSelectProduct = `
    SELECT product_stock, imei_number, product_id
    FROM products 
    WHERE product_id = ?
  `;

  const sqlUpdateProduct = `
    UPDATE products 
    SET product_stock = ?, imei_number = ?
    WHERE product_id = ?
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
console.log(req.body);
  const { product_id } = req.params; // Extract product_name from the request URL
  const { product_stock, imei_number, user, category } = req.body; // Extract new stock and IMEI numbers
  const getStoreNameQuery = `SELECT s.store_name FROM users u JOIN stores s ON u.store_id = s.store_id WHERE u.user_id = ?`;

  try {
    // Step 1: Fetch store_name for the user
    const [store] = await db.query(getStoreNameQuery, [user]);
    if (store.length === 0) {
      return res
        .status(400)
        .json({ message: "Store not found for the given user." });
    }
    const storeName = store[0].store_name;

    // Step 2: Fetch existing stock and IMEI numbers from products table
    const [product] = await db.query(sqlSelectProduct, [product_id]);
    if (product.length === 0) {
      return res.status(404).json({ message: "Product not found." });
    }

    let currentStock = Number(product[0].product_stock);
    let currentIMEINumbers = product[0].imei_number
      ? product[0].imei_number.split(",")
      : [];
    const productId = product[0].product_id;

    // Step 3: Update IMEI numbers conditionally based on category
    let newIMEINumbers = []; // Declare outside for scope access
    if (category === "Mobile Phone") {
      // Ensure imei_number is present and valid when category is 'Mobile Phone'
      if (
        !imei_number ||
        !Array.isArray(imei_number) ||
        imei_number.length === 0 ||
        imei_number.includes(null)
      ) {
        return res.status(400).json({
          message: "IMEI number is required for Mobile Phone category.",
        });
      }
      newIMEINumbers = imei_number.filter((imei) => imei); // Filter out null or invalid values
      updatedIMEINumbers = [...currentIMEINumbers, ...newIMEINumbers].join(",");
    } else {
      // If the category is not 'Mobile Phone', do not include IMEI numbers
      updatedIMEINumbers = currentIMEINumbers.join(","); // Keep existing IMEI numbers
    }

    // Step 4: Update stock in products table by adding new quantity
    const updatedStock = currentStock + Number(product_stock);
    await db.query(sqlUpdateProduct, [
      updatedStock,
      updatedIMEINumbers,
      product_id,
    ]);

    // Step 5: Fetch current stock data for the store from stock table
    const [stock] = await db.query(sqlSelectStock, [productId, storeName]);
    if (stock.length > 0) {
      // Stock entry exists for this store, so update the record
      let currentStockQuantity = Number(stock[0].stock_quantity);
      let existingIMEINumbersInStock = stock[0].imei_numbers
        ? stock[0].imei_numbers.split(",")
        : [];

      // Merge IMEI numbers and update stock quantity
      const updatedStockQuantityInStore =
        currentStockQuantity + Number(product_stock);
      const updatedIMEINumbersInStore =
        category === "Mobile Phone"
          ? [...existingIMEINumbersInStock, ...newIMEINumbers].join(",")
          : existingIMEINumbersInStock.join(",");
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
        category === "Mobile Phone" ? newIMEINumbers.join(",") : "",
      ]);
    }

    return res.status(200).json({
      message:
        "Stock and IMEI numbers updated successfully in both products and stock tables.",
    });
  } catch (err) {
    console.error("Error updating Product and Stock:", err.message); // Log any error messages
    return res.status(500).json({ message: "Error inside server.", err });
  }
};


const checkimeiInStock = async (req, res) => {
  const { product_id, store_id, product_serial } = req.body;

  try {
    // Validate request parameters
    if (!product_id || !store_id || !product_serial) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Query to get stock data
    const [stockResult] = await db.query(
      "SELECT imei_numbers FROM stock WHERE product_id = ? AND store_name = ?",
      [product_id, store_id]
    );

    if (stockResult.length === 0) {
      return res.status(404).json({
        message: "Stock not found for the given product ID and store ID.",
      });
    }

    // Check if the serial number exists in the imei_numbers list
    const imeiNumbersList = stockResult[0].imei_numbers?.split(",") || [];
    const isSerialFound = imeiNumbersList.includes(product_serial);

    if (isSerialFound) {
      return res.status(200).json({
        message: "Serial number found in stock.",
      });
    } else {
     
      return res.status(404).json({
        message: "Serial number not found in stock.",
      });
    }
  } catch (error) {
    console.error("Error checking serial number:", error);
    res.status(500).json({ message: "Internal server error." });
  }

}






const getProductDetails = async (req, res) => {
  const { imei_number } = req.query;

  if (!imei_number) {
    return res
      .status(400)
      .json({ message: "Please provide a valid imei_number" });
  }

  try {
    // Step 1: Check if the product exists in the 'products' table (not yet sold)
    const productQuery = `
      SELECT 
        p.product_id,
        p.color,
        p.capacity,
        p.grade,
        p.product_name,
        p.product_price,
        p.product_type,
        p.brand_name,
        s.store_name,
        p.created_at AS date
      FROM products p
      INNER JOIN stock s ON p.product_id = s.product_id
      WHERE FIND_IN_SET(?, s.imei_numbers) > 0;
    `;

    const [products] = await db.query(productQuery, [imei_number]);

    if (products.length > 0) {
      // Product is in stock, return the details with sold = false and transfer = false by default
      let productDetails = { ...products[0], sold: false, transfer: false };

      return res.status(200).json(productDetails);
    } else {
      // Check if the product is also in the transfer table
      const transferQuery = `
        SELECT 
        p.product_id,
        p.product_name,
        p.product_price,
        p.product_type,
        p.brand_name,
        t.transfer_to,
        t.transfer_from
      FROM transfer t
      INNER JOIN products p ON FIND_IN_SET(?, t.imei_number) > 0 AND p.product_id = t.product_id
      WHERE t.transfer_approval = 'sending';
      `;
      const [transfers] = await db.query(transferQuery, [imei_number]);

      if (transfers.length > 0) {
        // IMEI is in the transfer table with status "sending"
        let productDetails = {
          ...transfers[0],
          sold: false,
          transfer: true,
        };
        return res.status(200).json(productDetails);
      }
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
        transfer: false,
      });
    }

    // Step 3: If not found in both tables, return a 404 response
    return res.status(404).json({ message: "Product not found" });
  } catch (err) {
    console.error("Error fetching product details:", err.message);
    return res.status(500).json({
      message: "Error inside server while fetching product details",
      err,
    });
  }
};

// Set up nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail", // Use your email service provider
  host: "smtp.gmail.email",
  port: 465,
  secure: true, // true for port 465, false for other ports
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS, // Use environment variables for sensitive data
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
      return;
    }

    // Format the low stock items for the email
    const lowStockList = lowStockItems
      .map(
        (item) =>
          `Store: ${item.store_name}, Product: ${item.product_name}, Quantity: ${item.stock_quantity}`
      )
      .join("\n");

    // Email options
    const mailOptions = {
      from: process.env.EMAIL,
      to: process.env.recipientEmail,
      subject: "Daily Low Stock Alert",
      text: `The following items have low stock (10 or less):\n\n${lowStockList}`,
    };

    // Send the email
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending low stock email:", error);
  }
};

// Schedule the task to run daily at 9:00 AM
cron.schedule("00 23 * * *", () => {
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
  getitembyname,
  getProductforMangerinventory,
  getProductcolor,
  getImeiNumbers,
  getProductCapacity,
  getitembetails,
  checkimeiInStock,
  getProductModelsByBrandNameStoreName,
  getProductDetailsByID,
  getproductbycode,
};

/*
  imei number to fetch from an array

  SELECT * FROM products
  WHERE FIND_IN_SET('12345', imei_number);
changes can be made if wanted

  */
