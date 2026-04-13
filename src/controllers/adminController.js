const Platform = require('../models/Platform');
const Product = require('../models/Product');
const { AdminConfig, ScraperJob } = require('../models/AdminConfig');
const { Transaction } = require('../models/AffiliateClick');
const CampaignSyncService = require('../services/campaignSyncService');
const { queues, cache } = require('../config/redis');
const logger = require('../utils/logger');

const AdminController = {

  // ─── PLATFORM MANAGEMENT ─────────────────────────────────────────────────

  async getAllPlatforms(req, res) {
    try {
      const platforms = await Platform.find()
        .sort({ displayOrder: 1 })
        .lean();

      // Attach product counts
      const counts = await Product.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$platformId', count: { $sum: 1 } } },
      ]);
      const countMap = Object.fromEntries(counts.map(c => [c._id.toString(), c.count]));

      const enriched = platforms.map(p => ({
        ...p,
        productCount: countMap[p._id.toString()] || 0,
      }));

      res.json({ success: true, data: enriched });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * PUT /admin/platforms/:id
   * Update admin-controlled fields: displayOrder, isActive, isFeatured, goldConfig
   */
  async updatePlatform(req, res) {
    try {
      const { displayOrder, isActive, isFeatured, goldConfig, logoUrl, systemCategoryMappings } = req.body;
      const update = {};
      if (displayOrder !== undefined) update.displayOrder = displayOrder;
      if (isActive !== undefined) update.isActive = isActive;
      if (isFeatured !== undefined) update.isFeatured = isFeatured;
      if (goldConfig !== undefined) update.goldConfig = goldConfig;
      if (logoUrl !== undefined) update.logoUrl = logoUrl;
      if (systemCategoryMappings !== undefined) update.systemCategoryMappings = systemCategoryMappings;

      const platform = await Platform.findByIdAndUpdate(
        req.params.id,
        { $set: update },
        { new: true }
      );

      if (!platform) return res.status(404).json({ success: false, message: 'Platform not found' });

      await cache.delPattern('ebazar:platforms:*');
      await cache.delPattern(`ebazar:platform:${platform.slug}*`);

      res.json({ success: true, data: platform });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * POST /admin/platforms/reorder
   * Bulk reorder — body: [{ platformId, displayOrder }]
   */
  async reorderPlatforms(req, res) {
    try {
      const { order } = req.body; // [{ platformId, displayOrder }]
      const ops = order.map(({ platformId, displayOrder }) => ({
        updateOne: {
          filter: { _id: platformId },
          update: { $set: { displayOrder } },
        },
      }));
      await Platform.bulkWrite(ops);
      await cache.delPattern('ebazar:platforms:*');
      res.json({ success: true, message: 'Platform order updated' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── CAMPAIGN SYNC ────────────────────────────────────────────────────────

  async triggerCampaignSync(req, res) {
    try {
      logger.info('Starting manual synchronous campaign sync from admin request...');
      const result = await CampaignSyncService.syncAllCampaigns();
      res.json({ success: true, message: 'Campaign sync completed', data: result });
    } catch (err) {
      logger.error('Error in manual campaign sync: ' + err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async syncSinglePlatform(req, res) {
    try {
      const { inrDealsId } = req.params;
      const platform = await CampaignSyncService.syncSingleCampaign(inrDealsId);
      res.json({ success: true, data: platform });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── SCRAPER MANAGEMENT ───────────────────────────────────────────────────

  async triggerScrape(req, res) {
    try {
      const { platformId } = req.params;
      const platform = await Platform.findById(platformId);
      if (!platform) return res.status(404).json({ success: false, message: 'Platform not found' });

      const job = await ScraperJob.create({
        platformId,
        platformName: platform.name,
        triggeredBy: 'admin',
        status: 'queued',
      });

      await queues.scrapeJobs.add('scrape-platform', {
        platformId: platform._id.toString(),
        platformSlug: platform.slug,
        jobId: job._id.toString(),
      }, {
        attempts: 2,
        backoff: { type: 'fixed', delay: 5000 },
      });

      res.json({ success: true, data: { jobId: job._id, message: 'Scrape queued' } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getScraperJobs(req, res) {
    try {
      const { page, limit } = req.query;
      const jobs = await ScraperJob.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('platformId', 'name')
        .lean();
      res.json({ success: true, data: jobs });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── GOLD RULES MANAGEMENT ────────────────────────────────────────────────

  async getAdminConfig(req, res) {
    try {
      const config = await AdminConfig.findOne({ key: 'global' })
        .populate('goldRules.platformId', 'name')
        .lean();
      res.json({ success: true, data: config });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * PUT /admin/gold-rules
   * Upsert gold rules — admin sets % of commission given as gold
   */
  async updateGoldRules(req, res) {
    try {
      const { goldRules, defaultGoldPercent, categoryMappings, flags } = req.body;

      const update = { updatedBy: req.user.id };
      if (goldRules !== undefined) update.goldRules = goldRules;
      if (defaultGoldPercent !== undefined) update.defaultGoldPercent = defaultGoldPercent;
      if (categoryMappings !== undefined) update.categoryMappings = categoryMappings;
      if (flags !== undefined) update.flags = flags;

      const config = await AdminConfig.findOneAndUpdate(
        { key: 'global' },
        { $set: update },
        { upsert: true, new: true }
      );

      // Bust gold percent cache
      await cache.delPattern('ebazar:gold_pct:*');
      await cache.delPattern('ebazar:categories*');

      res.json({ success: true, data: config });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── PRODUCT MANAGEMENT ───────────────────────────────────────────────────

  async updateProduct(req, res) {
    try {
      const { isTrending, isFeatured, isActive, displayBoost, category, commissionSlabLabel, commissionPercent } = req.body;
      const update = {};
      if (isTrending !== undefined) update.isTrending = isTrending;
      if (isFeatured !== undefined) update.isFeatured = isFeatured;
      if (isActive !== undefined) update.isActive = isActive;
      if (displayBoost !== undefined) update.displayBoost = displayBoost;
      if (category !== undefined) update.category = category;
      if (commissionSlabLabel !== undefined) update.commissionSlabLabel = commissionSlabLabel;
      if (commissionPercent !== undefined) update.commissionPercent = commissionPercent;

      const product = await Product.findByIdAndUpdate(
        req.params.id, { $set: update }, { new: true }
      );
      if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

      await cache.delPattern('ebazar:products:*');
      res.json({ success: true, data: product });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── DASHBOARD STATS ─────────────────────────────────────────────────────

  async getDashboardStats(req, res) {
    try {
      const [
        totalPlatforms,
        activePlatforms,
        totalProducts,
        activeProducts,
        totalTransactions,
        pendingGold,
        creditedGold,
        totalGoldValue,
      ] = await Promise.all([
        Platform.countDocuments(),
        Platform.countDocuments({ isActive: true }),
        Product.countDocuments(),
        Product.countDocuments({ isActive: true }),
        Transaction.countDocuments(),
        Transaction.countDocuments({ goldStatus: 'pending' }),
        Transaction.countDocuments({ goldStatus: 'credited' }),
        Transaction.aggregate([
          { $match: { goldStatus: 'credited' } },
          { $group: { _id: null, total: { $sum: '$goldAmount' } } },
        ]),
      ]);

      res.json({
        success: true,
        data: {
          platforms: { total: totalPlatforms, active: activePlatforms },
          products: { total: totalProducts, active: activeProducts },
          transactions: { total: totalTransactions, pendingGold, creditedGold },
          goldCredited: totalGoldValue[0]?.total || 0,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── CATEGORY CONFIG ──────────────────────────────────────────────────────

  getSystemCategories(req, res) {
    try {
      const SYSTEM_CATEGORIES = require('../config/categories');
      res.json({ success: true, data: SYSTEM_CATEGORIES });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = AdminController;
