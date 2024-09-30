const db = require("../config/db");

 // Step 1: Generate the next ID
    const generateNextId = async (req, res) => {
        const user = req.body.user; 
  
      const query = "SELECT product_id FROM products";
      const [results] = await db.query(query);
      
      if (results.length === 0) {
        return `${(user)}0001`;
      }

      const ids = results.map(product => parseInt(product.product_id.slice(1)));
      const maxId = Math.max(...ids);
      return `${(user)}, ${(maxId + 1).toString().padStart(4, "0")}`;
    };



//make sale
const makesale = async (req, res) => {
    try {
        const { cashier_id, sales_person, total_amount, products, user } = req.body; 
        const sales_id = await generateNextId(req, res);
    
        if (!sales_id) {
          return res.status(500).json({ message: "Failed to generate sales ID." });
        }
    
        const salesQuery = `
          INSERT INTO sales (sales_id, cashier_id, sales_person, total_amount)
          VALUES (?, ?, ?, ?);
        `;
    
        await db.query(salesQuery, [sales_id, cashier_id, sales_person, total_amount]);
    
        const salesItemQuery = `
          INSERT INTO sales_item (sales_id, product_id, quantity, price, imei_number, discount)
          VALUES (?, ?, ?, ?, ?, ?);
        `;
    
        // Queries to update the stock in both `products` and `stores` tables
        const updateProductStockQuery = `
          UPDATE products
          SET stock = stock - ?
          WHERE product_id = ? AND stock >= ?;
        `;
    
        const updateStoreStockQuery = `
          UPDATE stores
          SET stock = stock - ?
          WHERE product_id = ? AND store_id = ? AND stock >= ?;
        `;
    
        for (const product of products) {
          const { product_id, quantity, price, imei_number, discount } = product;
    
          try {
            // Insert into the sales_item table
            await db.query(salesItemQuery, [sales_id, product_id, quantity, price, imei_number, discount]);
    
            // Update stock in the products table
            const [productStockUpdated] = await db.query(updateProductStockQuery, [quantity, product_id, quantity]);
    
            if (productStockUpdated.affectedRows === 0) {
              throw new Error(`Insufficient product stock for product ${product_id}.`);
            }
    
            // Update stock in the stores table (assuming user represents the store_id)
            const [storeStockUpdated] = await db.query(updateStoreStockQuery, [quantity, product_id, user, quantity]);
    
            if (storeStockUpdated.affectedRows === 0) {
              throw new Error(`Insufficient store stock for product ${product_id} in store ${user}.`);
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

const getsalebyid = async (req,res) => {
    

};



  
module.exports = {
    makesale,
    getsales,
    getsalebyid

  };
  

