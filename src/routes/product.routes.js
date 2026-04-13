const express = require('express');
const ProductController = require('../controllers/product.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Public facing Product viewing APIs
 */

/**
 * @swagger
 * /products/top:
 *   get:
 *     summary: Get top products for the home screen
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of products to return (default 10)
 *     responses:
 *       200:
 *         description: List of top trending/featured products
 */
router.get('/top', ProductController.getTopProducts);

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Get a paginated list of products
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: Filter products by Category ID (works for both parent and subcategories)
 *     responses:
 *       200:
 *         description: Paginated products
 */
router.get('/', ProductController.getProducts);

module.exports = router;
