const express = require('express');
const { authenticate, requireAdmin } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const {
  updatePlatformSchema,
  reorderPlatformsSchema,
  syncPlatformSchema,
  triggerScrapeSchema,
  getScraperJobsSchema,
  updateGoldRulesSchema,
  updateProductSchema
} = require('../validations/admin.validation');
const AdminController = require('../controllers/adminController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Administrator endpoints for platform management, scraping, and config
 */

// All admin routes should enforce Authentication and Role validation
// router.use(authenticate, requireAdmin); // Uncomment when ready to test Auth

/**
 * @swagger
 * /admin/platforms:
 *   get:
 *     summary: Retrieve all platforms
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: A list of all platforms with counts.
 */
router.get('/platforms', AdminController.getAllPlatforms);

/**
 * @swagger
 * /admin/platforms/{id}:
 *   put:
 *     summary: Update platform fields
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayOrder:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *               isFeatured:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated platform
 */
router.put('/platforms/:id', validate(updatePlatformSchema), AdminController.updatePlatform);

/**
 * @swagger
 * /admin/platforms/reorder:
 *   post:
 *     summary: Bulk reorder platforms
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               order:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     platformId:
 *                       type: string
 *                     displayOrder:
 *                       type: number
 *     responses:
 *       200:
 *         description: Order updated successfully
 */
router.post('/platforms/reorder', validate(reorderPlatformsSchema), AdminController.reorderPlatforms);

// ─── CAMPAIGN SYNC ───────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/sync/campaigns:
 *   post:
 *     summary: Trigger manual sync of all active campaigns from INRDeals
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Sync initiated and completed
 */
router.post('/sync/campaigns', AdminController.triggerCampaignSync);

/**
 * @swagger
 * /admin/sync/campaign/{inrDealsId}:
 *   post:
 *     summary: Sync a specific campaign from INRDeals
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: inrDealsId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Target campaign synced
 */
router.post('/sync/campaign/:inrDealsId', validate(syncPlatformSchema), AdminController.syncSinglePlatform);

// ─── SCRAPER MANAGEMENT ──────────────────────────────────────────────────

/**
 * @swagger
 * /admin/scrape/{platformId}:
 *   post:
 *     summary: Trigger a scrape job for a platform
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: platformId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Scrape job queued
 */
router.post('/scrape/:platformId', validate(triggerScrapeSchema), AdminController.triggerScrape);

/**
 * @swagger
 * /admin/scrape/jobs:
 *   get:
 *     summary: List scraper jobs
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         default: 20
 *     responses:
 *       200:
 *         description: Paginated list of scraper jobs
 */
router.get('/scrape/jobs', validate(getScraperJobsSchema), AdminController.getScraperJobs);

// ─── GOLD RULES MANAGEMENT ───────────────────────────────────────────────

/**
 * @swagger
 * /admin/gold-rules:
 *   get:
 *     summary: Get central Gold Rules configuration
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Global configuration loaded
 */
router.get('/gold-rules', AdminController.getAdminConfig);

/**
 * @swagger
 * /admin/gold-rules:
 *   put:
 *     summary: Update Gold Rules configuration
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               defaultGoldPercent:
 *                 type: number
 *               goldRules:
 *                 type: array
 *     responses:
 *       200:
 *         description: Configuration updated
 */
router.put('/gold-rules', validate(updateGoldRulesSchema), AdminController.updateGoldRules);

// ─── PRODUCT MANAGEMENT ──────────────────────────────────────────────────

/**
 * @swagger
 * /admin/products/{id}:
 *   put:
 *     summary: Update product metadata
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isTrending:
 *                 type: boolean
 *               isFeatured:
 *                 type: boolean
 *               isActive:
 *                 type: boolean
 *               displayBoost:
 *                 type: number
 *     responses:
 *       200:
 *         description: Product updated
 */
router.put('/products/:id', validate(updateProductSchema), AdminController.updateProduct);

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Fetch overview counts and stats for admin dashboard
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Dashboard statistics
 */
router.get('/dashboard', AdminController.getDashboardStats);

// ─── CONFIGURATION ───────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/categories:
 *   get:
 *     summary: Fetch available generic categories
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of categories mapped to the admin
 */
router.get('/categories', AdminController.getSystemCategories);

module.exports = router;
