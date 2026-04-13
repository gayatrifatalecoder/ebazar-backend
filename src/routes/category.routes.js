const express = require('express');
const CategoryController = require('../controllers/category.controller');
const { validate } = require('../middlewares/validate');
const { categoryIdParamSchema } = require('../validations/category.validation');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: API to manage categories and mapping
 */

// ─── PUBLIC CATEGORY ROUTES ───────────────────────────────────────────────

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: Get all main categories
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: List of main categories
 */
router.get('/', CategoryController.getAllCategories);

/**
 * @swagger
 * /categories/tree:
 *   get:
 *     summary: Get full category tree
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Full nested list of categories and subcategories
 */
router.get('/tree', CategoryController.getCategoryTree);

/**
 * @swagger
 * /categories/{id}/subcategories:
 *   get:
 *     summary: Get subcategories by category ID
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The category ID
 *     responses:
 *       200:
 *         description: List of subcategories
 */
router.get('/:id/subcategories', validate(categoryIdParamSchema), CategoryController.getSubcategories);

/**
 * @swagger
 * /categories/{id}/platforms:
 *   get:
 *     summary: Get platforms mapped to a Category ID
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The category ID
 *     responses:
 *       200:
 *         description: List of mapped platforms
 */
router.get('/:id/platforms', validate(categoryIdParamSchema), CategoryController.getPlatformsByCategory);

module.exports = router;
