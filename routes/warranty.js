const express = require("express");
const {
    getAllWarranties,
    getWarrantyById,
    getWarrantyByProductId,
    getWarrantyBySaleId,
    addWarranty,
    updateWarranty,
    deleteWarranty,
} = require("../controllers/warranty");

const router = express.Router();

// Get all warranties
router.get("/", getAllWarranties);

// Get warranty by ID
router.get("/id/:warranty_id", getWarrantyById);

// Get warranty by product ID
router.get("/product/:product_id", getWarrantyByProductId);

// Get warranty by sales ID
router.get("/sales/:sale_id", getWarrantyBySaleId);

// Add a new warranty
router.post("/", addWarranty);

// Update an existing warranty by ID
router.put("/:warranty_id", updateWarranty);

// Delete a warranty by ID
router.delete("/:warranty_id", deleteWarranty);

module.exports = router;
