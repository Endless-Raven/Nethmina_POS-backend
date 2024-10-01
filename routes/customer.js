const express = require("express");
const {
    getCustomers,
    getCustomerById,
    getCustomerByEmail,
    getCustomerByPhoneNumber,
    addCustomer,
    updateCustomer,
    deleteCustomer,
} = require("../controllers/customer");

const router = express.Router();

router.get("/", getCustomers); //get all customers
router.get('/customerID/:id', getCustomerById);//customer by ID
router.get('/email/:email', getCustomerByEmail);//cusomer by email
router.get('/phone/:phone_number', getCustomerByPhoneNumber); //customer by phone number


router.post("/", addCustomer); // Sign up

router.put("/:customer_id", updateCustomer); // Update customer
router.delete("/:customer_id", deleteCustomer); // Delete customer

module.exports = router;
