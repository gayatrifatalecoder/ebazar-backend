const Platform = require('../models/Platform');
const RewardHighlightService = require('../services/rewardHighlightService');

const PlatformController = {
  /**
   * GET /platforms
   * Returns a paginated list of active platforms with their gold badges.
   */
  async getPlatforms(req, res) {
    try {
      const { page = 1, limit = 20, region = 'IN', isFeatured, category } = req.query;
      
      const query = { isActive: true };
      if (isFeatured === 'true') query.isFeatured = true;
      if (category) {
        query['systemCategoryMappings.systemCategory'] = category;
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { displayOrder: 1, name: 1 },
        select: 'name slug logoUrl store.logo_url tier.payout tier.slabs goldRewardRules goldConfig isFeatured',
        lean: true
      };

      const result = await Platform.paginate(query, options);

      // Inject dynamic gold badges
      result.docs = result.docs.map(platform => ({
        ...platform,
        maxGoldBadge: RewardHighlightService.getPlatformBadge(platform, region)
      }));

      res.json({
        success: true,
        data: result.docs,
        pagination: {
          total: result.totalDocs,
          pages: result.totalPages,
          currentPage: result.page
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * GET /platforms/:slug
   * Returns detailed information for a single platform.
   */
  async getPlatformBySlug(req, res) {
    try {
      const { slug } = req.params;
      const { region = 'IN' } = req.query;

      const platform = await Platform.findOne({ slug, isActive: true }).lean();
      if (!platform) {
        return res.status(404).json({ success: false, message: 'Platform not found' });
      }

      platform.maxGoldBadge = RewardHighlightService.getPlatformBadge(platform, region);

      res.json({ success: true, data: platform });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = PlatformController;
