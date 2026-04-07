const express = require('express');
const { verifyScraperKey } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { productIngestionSchema } = require('../validations/scraper.validation');
const scraperController = require('../controllers/scraper.controller');

const router = express.Router();

// POST /api/scraper/products
// Rate limits apply from global express limit
router.post(
  '/products',
  verifyScraperKey,
  validate(productIngestionSchema),
  scraperController.ingestProducts
);

module.exports = router;
