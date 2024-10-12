const db = require("../config/db");

//add item
const additem = async (req, res) => {
  console.log("Request body", req.body);

  // Step 1: Check if the product already exists by product_name
  const checkProductQuery = `SELECT imei_number, product_stock, product_id FROM products WHERE product_name = ?`;
  const getStoreNameQuery = `SELECT s.store_name FROM users u JOIN stores s ON u.store_id = s.store_id WHERE u.user_id = ?`;

  try {
    // Fetch store_name by user from req.body (assuming req.body.user contains the user_id)
    const [store] = await db.query(getStoreNameQuery, [req.body.user]);

    if (store.length === 0) {
      return res.status(400).json({ message: "Store not found for the given user." });
    }

    const storeName = store[0].store_name;

    const [product] = await db.query(checkProductQuery, [req.body.product_name]);

    const newImeiNumbers = req.body.imei_numbers;  // Assuming imei_numbers is an array in req.body

    if (product.length > 0) {
      // Step 2: Product exists, check IMEI numbers
      const existingImeiNumbers = product[0].imei_number ? product[0].imei_number.split(",") : [];

      // Check if any of the IMEI numbers already exist in the product
      const duplicateImeiNumbers = newImeiNumbers.filter(imei => existingImeiNumbers.includes(imei));

      if (duplicateImeiNumbers.length > 0) {
        return res.status(400).json({ message: `The following IMEI numbers already exist: ${duplicateImeiNumbers.join(", ")}` });
      } else {
        // Step 3: Append new IMEI numbers to the existing list and update the stock
        const updatedImeiNumbers = [...existingImeiNumbers, ...newImeiNumbers].join(",");

        const updateProductQuery = `
          UPDATE products
          SET imei_number = ?, product_stock = product_stock + ?
          WHERE product_name = ?;
        `;
        await db.query(updateProductQuery, [updatedImeiNumbers, req.body.product_stock, req.body.product_name]);

        // Step 4: Update the stock table for this store
        const checkStockQuery = `SELECT * FROM stock WHERE product_id = ? AND store_name = ?`;
        const [existingStock] = await db.query(checkStockQuery, [product[0].product_id, storeName]);

        if (existingStock.length > 0) {
          // Update the existing stock record
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
          // Insert new stock record
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
      // Step 5: Product doesn't exist, insert it as a new product
      const insertProductQuery = `
        INSERT INTO products (product_name, product_price, warranty_period, imei_number, product_stock, product_type, product_model, brand_name ,product_wholesale_price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?,?)
      `;

      const productValues = [
        req.body.product_name,
        req.body.product_price,
        req.body.warranty_period,
        newImeiNumbers.join(","), // Join array to string
        req.body.product_stock,
        req.body.product_type,
        req.body.product_model,
        req.body.brand_name,
        req.body.product_wholesale_price
      ];

      const [insertedProduct] = await db.query(insertProductQuery, productValues);
      console.log("Inserted Product ID:", insertedProduct.insertId); // Ensure this is correct

      // Step 6: Add entry to the stock table for the new product
      const insertStockQuery = `
        INSERT INTO stock (store_name, product_id, stock_quantity, imei_numbers)
        VALUES (?, ?, ?, ?)
      `;
      await db.query(insertStockQuery, [
        storeName,
        insertedProduct.insertId, // Product ID from the newly inserted product
        req.body.product_stock,
        newImeiNumbers.join(","), // Join array to string
      ]);
console.log("as",insertedProduct.insertId)
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
      SET product_name=? , product_price=?  , warranty_period=? , imei_number =? , product_stock =? , product_type =? , brand_name =?
      WHERE product_name = ?
    `;
  
    const product_name = req.params.product_name; 
  
    const values = [
      req.body.product_name,
      req.body.product_price,
      req.body.waranty_period,
      req.body.imei_number,
      req.body.product_stock,
      req.body.product_type,
      req.body.brand_name,
      product_name,

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
const deleteitem = async (req,res) =>{
    const sql = "DELETE FROM products WHERE product_name = ?;"; // Query using product_name
  const product_name = req.params.product_name; // Use product_name from the request parameters
  
  try {
    console.log("Deleting product:", product_name);
    const [result] = await db.query(sql, [product_name]); // Pass product_name to the query
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Product not found" }); // No rows affected, meaning the product doesn't exist
    }
    return res.json({ message: "Product deleted successfully", result });
  } catch (err) {
    console.error("Error deleting product:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }
};




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
    searchProductsByModel
  };
  

  /*
  imei number to fetch from an array

  SELECT * FROM products
  WHERE FIND_IN_SET('12345', imei_number);
changes can be made if wanted

  */ 