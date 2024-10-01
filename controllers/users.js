const db = require("../config/db");
const bcrypt = require('bcrypt');

// Get all users
const getUsers = async (req, res) => {
    const sql = "SELECT * FROM users";
    
    try {
      console.log("get users");
      const [rows] = await db.query(sql);
      return res.json(rows);
    } catch (err) {
      console.error("Error fetching users:", err.message);
      return res.status(500).json({ message: "Error inside server", err });
    }
  };

  // Get user by ID
const getUserById = async (req, res) => {
    const { id } = req.params; // Get user ID from request parameters
    const sql = "SELECT * FROM users WHERE user_id = ?";
  
    try {
      console.log(`Fetching user with ID: ${id}`);
      const [rows] = await db.query(sql, [id]);
  
      if (rows.length === 0) {
        return res.status(404).json({ message: "User not found." });
      }
  
      return res.json(rows[0]); // Return the first user (should be only one with the ID)
    } catch (err) {
      console.error("Error fetching user by ID:", err.message);
      return res.status(500).json({ message: "Error inside server", err });
    }
  };
  
  // Get users by role
const getUsersByRole = async (req, res) => {
    const { role } = req.params; // Get role from request parameters
    const sql = "SELECT * FROM users WHERE role = ?";
  
    try {
      console.log(`Fetching users with role: ${role}`);
      const [rows] = await db.query(sql, [role]);
  
      if (rows.length === 0) {
        return res.status(404).json({ message: "No users found with this role." });
      }
  
      return res.json(rows); // Return all users with the specified role
    } catch (err) {
      console.error("Error fetching users by role:", err.message);
      return res.status(500).json({ message: "Error inside server", err });
    }
  };
  
  // Get users by store name
const getUsersByStoreName = async (req, res) => {
    const { store_name } = req.params; // Get store_name from request parameters
  
    const sql = `
      SELECT users.*, stores.store_name
      FROM users
      INNER JOIN stores ON users.store_id = stores.store_id
      WHERE stores.store_name = ?
    `;
  
    try {
      console.log(`Fetching users from store: ${store_name}`);
      const [rows] = await db.query(sql, [store_name]);
  
      if (rows.length === 0) {
        return res.status(404).json({ message: "No users found for this store." });
      }
  
      return res.json(rows); // Return users associated with the given store
    } catch (err) {
      console.error("Error fetching users by store:", err.message);
      return res.status(500).json({ message: "Error inside server", err });
    }
  };
  

//signIn
const signIn = async (req, res) => {
    const { username, password } = req.body;
  
    const sql = `SELECT * FROM users WHERE username = ?`;
  
    try {
      const [rows] = await db.query(sql, [username]);
  
      if (rows.length === 0) {
        return res.status(404).json({ message: "User not found." });
      }
  
      const user = rows[0];
  
      const isMatch = await bcrypt.compare(password, user.password);
  
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid password." });
      }
  
      // If password matches, remove the password from the user object
      delete user.password;
  
      return res.status(200).json({ message: "Sign in successful.", user });
    } catch (err) {
      console.error("Error signing in:", err.message);
      return res.status(500).json({ message: "Error inside server.", err });
    }
  };
  

//add user/sign up
const addUser = async (req, res) => {

    console.log("Request body:", req.body); // Log the request body
  
    const hashedPassword = await bcrypt.hash(req.body.password, 10); 

    const sql = `
    INSERT INTO users (username, password, role, store_id)
    VALUES (?, ?, ?, ?)
  `;
  
  const values = [
    req.body.username,
    hashedPassword,
    req.body.role,
    req.body.store_id,
  ];
  
    try {
  
      const [result] = await db.query(sql, values);
      return res.status(200).json({ message: "user added successfully.", result });
    } catch (err) {
      console.error("Error adding user:", err.message);
      return res.status(500).json({ message: "Error inside server.", err });
    }
  };
  

//update a users
const updateUser = async (req, res) => {
  console.log("Request body:", req.body); // Log the request body
  const sql = `
      UPDATE users 
      SET username = ?, password = ?, role = ?, store_id= ?
      WHERE user_id = ?
    `;

    const userId = req.params.user_id;

    // Values for the SQL query
    const values = [
        req.body.username,
        req.body.password,
        req.body.role,
        req.body.store_id,
        userId,
    ];

  try {
    const [result] = await db.query(sql, values);
    return res.status(200).json({ message: "User updated successfully.", result });
  } catch (err) {
    console.error("Error updating User:", err.message); // Log any error messages
    return res.status(500).json({ message: "Error inside server.", err });
  }
};


// Delete a users
const deleteUser = async (req, res) => {
  const sql = "DELETE FROM users WHERE user_id = ?;";
  const value = req.params.user_id;

  try {
    console.log("delete user");
    const [result] = await db.query(sql, [value]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ Message: "user not found" });
    }
    return res.json({ Message: "user deleted successfully", result });
  } catch (err) {
    return res.status(500).json({ Message: "Error inside server", err });
  }
};

module.exports = {
  getUsers,
  getUserById,
  getUsersByRole,
  getUsersByStoreName,
  addUser,
  updateUser,
  deleteUser,
  signIn
};
