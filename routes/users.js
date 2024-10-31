const express = require("express");
const {
  getUsers,
  getUserById,
  getUsersByRole,
  getUsersByStoreName,
  addUser,
  updateUser,
  deleteUser,
  signIn
} = require("../controllers/users");

const router = express.Router();

router.get("/", getUsers); //get users
router.get("/userID/:id", getUserById);
router.get("/role/:role", getUsersByRole);
router.get("/storeName/:store_name", getUsersByStoreName);

router.delete("/delete_employee/:user_id", deleteUser); //delete users
router.put("/update_employee", updateUser); //update users

//add users/sign up
router.post("/", addUser);

//signIn
router.post("/signin", signIn);



module.exports = router;
