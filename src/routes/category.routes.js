const express = require('express');
const CategoryController = require('../controllers/category.controller');

const router = express.Router();

// ─── PUBLIC CATEGORY ROUTES ───────────────────────────────────────────────
// Get all main categories
router.get('/', CategoryController.getAllCategories);

// Get subcategories for a specific category ID
router.get('/:id/subcategories', CategoryController.getSubcategories);

module.exports = router;
