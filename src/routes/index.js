const express = require('express');
const adminRoutes = require('./admin.routes');
const scraperRoutes = require('./scraper.routes');
const categoryRoutes = require('./category.routes');
// const platformRoutes = require('./platform.routes');
// const webhookRoutes = require('./webhook.routes');

const router = express.Router();

// Register sub-routes
router.use('/admin', adminRoutes);
router.use('/scraper', scraperRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', require('./product.routes'));
// router.use('/platforms', platformRoutes);
// router.use('/webhooks', webhookRoutes);

module.exports = router;
