const db = require("../config/db");

//add item
const additem = async (req,res) =>{
    console.log("Request body",req.body);

    const sql = ` INSERT INTO products ( product_name , product_price  , warranty_period , imei_number ,product_stock ,product_type,brand_name )
     VALUES (?, ? , ? , ? , ? ,?,?)`;

     const values = [
        req.body.product_name,
        req.body.product_price,
        req.body.waranty_period,
        req.body.imei_number,
        req.body.product_stock,
        req.body.product_type,
        req.body.brand_name


     ]
  try{   const [result] = await db.query(sql, values);
    return res.status(200).json({ message: "Product added successfully.", result });
  } catch (err) {
    console.error("Error adding Product:", err.message);
    return res.status(500).json({ message: "Error inside server.", err });
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
    deleteitem
  };
  