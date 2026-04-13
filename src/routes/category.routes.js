const express = require('express');
const CategoryController = require('../controllers/category.controller');

const router = express.Router();

// ─── PUBLIC CATEGORY ROUTES ───────────────────────────────────────────────
// Get all main categories (Level 1)
router.get('/', CategoryController.getAllCategories);

// Get the full category tree
router.get('/tree', CategoryController.getCategoryTree);

// Get subcategories for a specific category ID
router.get('/:id/subcategories', CategoryController.getSubcategories);

// Get platforms associated with a specific category ID
router.get('/:id/platforms', CategoryController.getPlatformsByCategory);

module.exports = router;
