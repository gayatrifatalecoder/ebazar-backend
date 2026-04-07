const Platform = require('../models/Platform');
const INRDealsService = require('./inrDealsService');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

const CampaignSyncService = {
  /**
   * Full sync: fetch all active INRDeals campaigns → upsert as Platforms
   * Called by cron job every 4 hours and on demand from admin
   */
  async syncAllCampaigns() {
    logger.info('Starting full campaign sync from INRDeals...');
    const results = { synced: 0, failed: 0, skipped: 0 };

    try {
      const response = await INRDealsService.getCampaigns();
      const campaigns = response?.data || [];

      logger.info(`Fetched ${campaigns.length} campaigns from INRDeals`);

      for (const campaignSummary of campaigns) {
        try {
          // campaignSummary from the list API lacks 'tier' (slabs/config)
          // Fetch full detail for each to ensure we get the complete data
          const fullDetail = await INRDealsService.getCampaignById(campaignSummary.id);
          
          await this.upsertPlatform(fullDetail);
          results.synced++;

          // Delay to prevent hitting rate limits during bulk sync
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          logger.error(`Failed to sync campaign ${campaignSummary.id}: ${err.message}`);
          results.failed++;
        }
      }

      // Bust platform cache after sync
      await cache.delPattern('ebazar:platforms:*');
      logger.info(`Campaign sync complete: ${JSON.stringify(results)}`);
    } catch (err) {
      logger.error(`Campaign sync fatal error: ${err.message}`);
      throw err;
    }

    return results;
  },

  async syncSingleCampaign(inrDealsId) {
    const fullDetail = await INRDealsService.getCampaignById(inrDealsId);
    const platform = await this.upsertPlatform(fullDetail);
    await cache.delPattern(`ebazar:platforms:*`);
    return platform;
  },

  async upsertPlatform(campaignDetail) {
    const mapped = INRDealsService.mapCampaignToPlatform(campaignDetail);

    const existing = await Platform.findOne({ inrDealsId: mapped.inrDealsId });

    if (existing) {
      // Only update INRDeals-sourced fields — preserve admin overrides
      const updateFields = {
        name: mapped.name,
        description: mapped.description,
        conversionRate: mapped.conversionRate,
        access: mapped.access,
        status: mapped.status,
        multistep: mapped.multistep,
        defaultUrl: mapped.defaultUrl,
        logoUrl: mapped.logoUrl || existing.logoUrl, // prefer existing if INRDeals has none
        store: mapped.store,
        cookieDuration: mapped.cookieDuration,
        clickAttribution: mapped.clickAttribution,
        regions: mapped.regions,
        type: mapped.type,
        categories: mapped.categories,
        subcategories: mapped.subcategories,
        tier: mapped.tier, // This contains slabs, terms, config etc.
        inventoryIdUsed: mapped.inventoryIdUsed,
        lastSyncedAt: new Date(),
        syncStatus: 'synced',
      };

      await Platform.findByIdAndUpdate(existing._id, { $set: updateFields });
      logger.debug(`Updated platform: ${mapped.name}`);
      return existing;
    } else {
      // New platform — create with defaults
      const platform = await Platform.create({
        ...mapped,
        isActive: false, // admin must explicitly activate new platforms
        displayOrder: 999,
      });
      logger.info(`Created new platform: ${mapped.name} (${platform._id})`);
      return platform;
    }
  },

  /**
   * Match a product's category slug to the correct commission slab
   * Uses AdminConfig categoryMappings to find the right slab label
   * Falls back to highest-percentage slab if no match
   */
  async resolveCommissionSlab(platform, ourCategory, isNewUser = null) {
    const { AdminConfig } = require('../models/AdminConfig');
    const adminConfig = await AdminConfig.findOne({ key: 'global' });
    const mappings = adminConfig?.categoryMappings || [];

    const slabs = platform.tier?.slabs || [];

    // Find mapping for our category
    const mapping = mappings.find(m =>
      m.ourCategory === ourCategory && m.isActive
    );

    if (!mapping) {
      // Fallback to highest percentage slab
      const best = slabs
        .filter(s => s.commission && s.commission[0]?.percentage > 0)
        .sort((a, b) => b.commission[0].percentage - a.commission[0].percentage)[0];

      return best || { label: 'Default', percentage: 0 };
    }

    // If isNewUser is known, try to use it; otherwise use the mapped slab
    const matchingSlab = slabs.find(s =>
      s.label === mapping.inrDealsSlabLabel
    );

    return matchingSlab || { label: mapping.inrDealsSlabLabel, percentage: 0 };
  },
};

module.exports = CampaignSyncService;
