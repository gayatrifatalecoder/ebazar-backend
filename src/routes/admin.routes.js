const express = require('express');
const { authenticate, requireAdmin } = require('../middlewares/auth');
const AdminController = require('../controllers/adminController');

const router = express.Router();

// All admin routes should enforce Authentication and Role validation
// router.use(authenticate, requireAdmin); // Uncomment when ready to test Auth

// ─── PLATFORM MANAGEMENT ──────────────────────────────────────────────────
router.get('/platforms', AdminController.getAllPlatforms);
router.put('/platforms/:id', AdminController.updatePlatform);
router.post('/platforms/reorder', AdminController.reorderPlatforms);

// ─── CAMPAIGN SYNC ───────────────────────────────────────────────────────
router.post('/sync/campaigns', AdminController.triggerCampaignSync);
router.post('/sync/campaign/:inrDealsId', AdminController.syncSinglePlatform);

// ─── SCRAPER MANAGEMENT ──────────────────────────────────────────────────
router.post('/scrape/:platformId', AdminController.triggerScrape);
router.get('/scrape/jobs', AdminController.getScraperJobs);

// ─── GOLD RULES MANAGEMENT ───────────────────────────────────────────────
router.get('/gold-rules', AdminController.getAdminConfig);
router.put('/gold-rules', AdminController.updateGoldRules);

// ─── PRODUCT MANAGEMENT ──────────────────────────────────────────────────
router.put('/products/:id', AdminController.updateProduct);

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────
router.get('/dashboard', AdminController.getDashboardStats);

module.exports = router;
