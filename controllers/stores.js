const db = require("../config/db");

//Add Sotre
const addStore = async (req, res) => {
  const sql = ` INSERT INTO stores ( store_name , store_address  , store_phone_number )
     VALUES (?, ? , ?)`;

  const values = [
    req.body.store_name,
    req.body.store_address,
    req.body.store_phone_number,
  ];

  try {
    const [result] = await db.query(sql, values);
    return res
      .status(200)
      .json({ message: "store added successfully.", result });
  } catch (err) {
    console.error("Error adding Product:", err.message);
    return res.status(500).json({ message: "Error inside server.", err });
  }
};
//GET Sotre
const getStore = async (req, res) => {
  const sql = "SELECT * FROM stores";

  try {
    const [rows] = await db.query(sql);
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching stores:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }
};

//get Store By name
const getstorenamebyid = async (req, res) => {
  const store_id = req.params.store_id;

  const sql = `
        SELECT *
        FROM stores
        WHERE store_id = ?`;

  try {
    const [rows] = await db.query(sql, [store_id]); // Pass the store ID as a parameter to the query

    if (rows.length === 0) {
      return res.status(404).json({ message: "store not found." }); // Handle case where no product is found
    }

    return res.json(rows[0]); // Return the found store name
  } catch (err) {
    console.error("Error fetching store:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }
};

//get Store By name
const getstorebyname = async (req, res) => {
  const store_name = req.params.store_name;

  const sql = `
        SELECT *
        FROM stores
        WHERE store_name = ?`;

  try {
    const [rows] = await db.query(sql, [store_name]); // Pass the product ID as a parameter to the query

    if (rows.length === 0) {
      return res.status(404).json({ message: "store not found." }); // Handle case where no product is found
    }

    return res.json(rows[0]); // Return the found product
  } catch (err) {
    console.error("Error fetching product:", err.message);
    return res.status(500).json({ message: "Error inside server", err });
  }
};

//update store
const updatestorebyname = async (req, res) => {
  const { store_id, store_name, store_address, store_phone_number } = req.body;

  const updateShopQuery = `
    UPDATE stores
    SET store_name = ?, store_address = ?, store_phone_number = ?
    WHERE store_id = ?
  `;

  try {
    await db.query(updateShopQuery, [
      store_name,
      store_address,
      store_phone_number,
      store_id,
    ]);
    res.json({ message: "Shop updated successfully" });
  } catch (err) {
    console.error("Error updating shop:", err.message);
    res.status(500).json({ message: "Error inside server", err });
  }
};

const getstorenames = async (req, res) => {
  const sql = "SELECT store_name FROM stores"; // Assuming 'stores' is your table name

  try {
    // Execute the SQL query to get all store names
    const [rows] = await db.query(sql);

    // If no stores are found, return a 404 response
    if (rows.length === 0) {
      return res.status(404).json({ message: "No stores found." });
    }

    // Map through the rows to get only the store names
    const storeNames = rows.map((row) => row.store_name);

    // Return the store names as an array in the response
    return res.json(storeNames);
  } catch (err) {
    console.error("Error fetching store names:", err.message);
    return res
      .status(500)
      .json({ message: "Error inside server during store name fetch.", err });
  }
};

// Update store details
const updateStoreById = async (req, res) => {
  const { store_address, store_phone_number, store_id } = req.body; // Destructure the request body
  const sql = `
      UPDATE stores
      SET  store_address = ?, store_phone_number = ?
      WHERE store_id = ?;
  `;

  try {
    const [result] = await db.query(sql, [
      store_address,
      store_phone_number,
      store_id,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Store not found." });
    }

    return res.status(200).json({ message: "Store updated successfully." });
  } catch (err) {
    console.error("Error updating store:", err.message);
    return res.status(500).json({ message: "Error inside server.", err });
  }
};

// Delete a store
const deleteStore = async (req, res) => {
  const { store_id } = req.params;

  const deleteShopQuery = `DELETE FROM stores WHERE store_id = ?`;

  try {
    const [result] = await db.query(deleteShopQuery, [store_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Shop not found." });
    }

    res.json({ message: "Shop removed successfully" });
  } catch (err) {
    console.error("Error deleting shop:", err.message);
    res.status(500).json({ message: "Error inside server", err });
  }
};

module.exports = {
  addStore,
  getStore,
  getstorebyname,
  updatestorebyname,
  getstorenames,
  getstorenamebyid,
  updateStoreById,
  deleteStore,
};
