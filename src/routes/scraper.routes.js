const express = require('express');
const { verifyScraperKey } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { productIngestionSchema, pythonScraperPayloadSchema } = require('../validations/scraper.validation');
const scraperController = require('../controllers/scraper.controller');
const ProductController = require('../controllers/product.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Scraper Setup
 *   description: Endpoints to receive data from the Python Scraper service
 */

/**
 * @swagger
 * /scraper/products:
 *   post:
 *     summary: Ingest a newly scraped product from Python Service
 *     tags: [Scraper Setup]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               platform:
 *                 type: string
 *               product_name:
 *                 type: string
 *               url:
 *                 type: string
 *               image:
 *                 type: string
 *               original_price:
 *                 type: string
 *               discounted_price:
 *                 type: string
 *               currency:
 *                 type: string
 *               rating:
 *                 type: string
 *               category:
 *                 type: string
 *               sub_category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Product saved or updated successfully
 */
router.post('/products', validate(pythonScraperPayloadSchema), ProductController.ingestScrapedProduct);

// POST /api/scraper/ingest (Legacy Apify Scraper)
// Rate limits apply from global express limit
router.post(
  '/ingest',
  verifyScraperKey,
  validate(productIngestionSchema),
  scraperController.ingestProducts
);

module.exports = router;
