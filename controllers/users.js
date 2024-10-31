const db = require("../config/db");
const bcrypt = require("bcrypt");

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
      return res
        .status(404)
        .json({ message: "No users found with this role." });
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
      return res
        .status(404)
        .json({ message: "No users found for this store." });
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
  const { full_name, username, role, phone, store_id, password } = req.body;

  try {
    // Hash the password before storing it
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the new employee into the users table
    const insertEmployeeQuery = `
      INSERT INTO users (full_name, username, password, role, user_phone_number, store_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await db.query(insertEmployeeQuery, [
      full_name,
      username,
      hashedPassword,
      role,
      phone,
      store_id,
    ]);

    // If the role is "cashier", also insert into the cashiers table
    if (role === "cashier") {
      const insertCashierQuery = `
        INSERT INTO cashiers (cashier_name, cashier_email, cashier_phone_number, store_id, created_at)
        VALUES (?, ?, ?, ?, NOW())
      `;

      await db.query(insertCashierQuery, [
        username,
        username, 
        phone,
        store_id,
      ]);
    }

    res.json({ message: "Employee account added successfully" });
  } catch (err) {
    console.error("Error adding employee account:", err.message);
    res.status(500).json({ message: "Error inside server", err });
  }
};


//update a users
// Route to update an employee's information
const updateUser = async (req, res) => {
  const { user_id, username, role, phone, store_id } = req.body;

  // Ensure required fields are present
  if (!user_id || !username || !role || !phone || !store_id) {
    return res.status(400).json({ message: "All fields are required to update an employee." });
  }

  // SQL query to update employee details in users table
  const updateEmployeeQuery = `
    UPDATE users
    SET username = ?, role = ?, user_phone_number = ?, store_id = ?
    WHERE user_id = ?
  `;

  try {
    // Execute the query with the provided values
    const [result] = await db.query(updateEmployeeQuery, [username, role, phone, store_id, user_id]);

    // Check if any rows were affected (i.e., if the update was successful)
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Employee not found." });
    }

    // Send success response
    res.json({ message: "Employee updated successfully" });
  } catch (err) {
    console.error("Error updating employee:", err.message);
    res.status(500).json({ message: "Error inside server", err });
  }
};

// Delete a users
const deleteUser = async (req, res) => {
  const { user_id } = req.params;

  const deleteEmployeeQuery = `DELETE FROM users WHERE user_id = ?`;

  try {
    const [result] = await db.query(deleteEmployeeQuery, [user_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Employee not found." });
    }

    res.json({ message: "Employee removed successfully" });
  } catch (err) {
    console.error("Error deleting employee:", err.message);
    res.status(500).json({ message: "Error inside server", err });
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
  signIn,
};
