const db = require("../config/db");

//add item
const additem = async (req, res) => {
  console.log("Request body", req.body);

  // Step 1: Check if the product already exists by product_name
  const checkProductQuery = `SELECT imei_number, product_stock FROM products WHERE product_name = ?`;
  
  try {
    const [product] = await db.query(checkProductQuery, [req.body.product_name]);
    
    if (product.length > 0) {
      // Step 2: Product exists, check IMEI number
      const existingImeiNumbers = product[0].imei_number ? product[0].imei_number.split(",") : [];

      if (existingImeiNumbers.includes(req.body.imei_number)) {
        // If IMEI number already exists, return a message and don't add the product
        return res.status(400).json({ message: "Product and IMEI number already exist." });
      } else {
        // Step 3: IMEI number is new, append it to the existing list and update the stock
        const newImeiNumbers = [...existingImeiNumbers, req.body.imei_number];
        const updatedImeiNumbers = newImeiNumbers.join(",");

        const updateProductQuery = `
          UPDATE products
          SET imei_number = ?, product_stock = product_stock + ?
          WHERE product_name = ?;
        `;
        
        await db.query(updateProductQuery, [updatedImeiNumbers, req.body.product_stock, req.body.product_name]);

        return res.status(200).json({ message: "IMEI number added and stock updated for existing product.", updatedImeiNumbers });
      }
    } else {
      // Step 4: Product doesn't exist, insert it as a new product
      const sql = `
        INSERT INTO products (product_name, product_price, warranty_period, imei_number, product_stock, product_type , product_model, brand_name)
        VALUES (?, ?, ?, ?, ?, ?, ? , ?)
      `;

      const values = [
        req.body.product_name,
        req.body.product_price,
        req.body.waranty_period,
        req.body.imei_number,
        req.body.product_stock,
        req.body.product_type,
        req.body.product_model,
        req.body.brand_name
      ];

      const [result] = await db.query(sql, values);

      return res.status(200).json({ message: "New product added successfully.", result });
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
    getBrandsByProductType
  };
  

  /*
  imei number to fetch from an array

  SELECT * FROM products
  WHERE FIND_IN_SET('12345', imei_number);
changes can be made if wanted

  */ 