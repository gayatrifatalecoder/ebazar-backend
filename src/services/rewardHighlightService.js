const Platform = require('../models/Platform');
const Category = require('../models/Category');
const { cache } = require('../config/redis');

/**
 * RewardHighlightService
 * Logic to find the 'Best Reward' (e.g. 10% Gold) for any given Category and Region.
 * Used for the badge labels on the Home Screen.
 */
const RewardHighlightService = {
  /**
   * Get the highest reward badge for all categories in a specific region
   */
  async getCategoryHighlights(region = 'IN') {
    const cacheKey = `ebazar:cat_highlights:${region}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    // 1. Fetch all platforms with their rules
    const platforms = await Platform.find({
      isActive: true,
      'goldRewardRules.region': region
    }).select('name logoUrl goldRewardRules').lean();

    const highlights = {};

    // 2. Iterate through platforms and find the max reward per category
    platforms.forEach(platform => {
      platform.goldRewardRules.forEach(rule => {
        if (rule.region !== region || !rule.isActive || !rule.systemCategoryId) return;

        const catId = rule.systemCategoryId.toString();

        // Build the display label (e.g., "12% Gold", "₹50 Reward", "0.01g Gold")
        const label = this.formatRewardLabel(rule);

        if (!highlights[catId] || this.isBetterReward(rule, highlights[catId].rule)) {
          highlights[catId] = {
            badge: label,
            bestPlatform: {
              name: platform.name,
              logo: platform.logoUrl
            },
            rule: {
              type: rule.rewardType,
              value: rule.rewardValue
            }
          };
        }
      });
    });

    // 3. Clean up and cache
    const result = Object.fromEntries(
      Object.entries(highlights).map(([catId, data]) => [
        catId,
        {
          maxGoldBadge: data.badge,
          bestPlatform: data.bestPlatform
        }
      ])
    );

    await cache.set(cacheKey, result, 3600); // 1 hour cache
    return result;
  },

  /**
   * Helper to format the UI label
   */
  formatRewardLabel(rule) {
    const { rewardType, rewardValue, currency } = rule;
    if (rewardType === 'percentage_of_commission') return `${rewardValue}% Gold`;
    if (rewardType === 'fixed_amount') return `${currency === 'AED' ? 'AED' : '₹'}${rewardValue} Reward`;
    if (rewardType === 'fixed_grams') return `${rewardValue}g Gold`;
    return `${rewardValue}%`;
  },

  /**
   * Helper to determine which reward is 'Better' 
   */
  isBetterReward(newRule, existingRule) {
    if (!existingRule) return true;
    return newRule.rewardValue > (existingRule.rewardValue || existingRule.value || 0);
  },

  /**
   * Get the best gold reward badge for a specific platform object.
   * Handles all INRDeals slab types:
   *  - Flat Rate (percentage)
   *  - Fixed Amount (Rs.X fixed)
   *  - Price Range (multiple commission tiers per slab)
   *  - Category-Based / New-Old User Split (multiple slabs, each with %)
   */
  getPlatformBadge(platform, region = 'IN') {
    const slabs = platform.tier?.slabs || [];
    const defaultShare = platform.goldConfig?.defaultGoldPercent || 0;

    // No slabs at all — nothing to calculate
    if (slabs.length === 0 || defaultShare === 0) return null;

    let maxRewardValue = 0;
    let bestLabel = null;
    let bestType = 'percentage'; // 'percentage' or 'fixed'

    slabs.forEach(slab => {
      // Check for manual admin override for this slab first
      const rule = platform.goldRewardRules?.find(r =>
        r.slabLabel === slab.label &&
        r.region === region &&
        r.isActive
      );

      if (rule) {
        // Manual rule always wins for this slab
        if (rule.rewardValue >= maxRewardValue) {
          maxRewardValue = rule.rewardValue;
          bestLabel = this.formatRewardLabel(rule);
        }
        return; // Next slab
      }

      // No manual rule — calculate dynamically from each commission tier
      const commissions = slab.commission || [];
      commissions.forEach(tier => {
        const pct = tier.percentage || 0;
        const fixed = tier.fixed || 0;

        if (pct > 0) {
          // Percentage commission: calculate gold share
          const goldVal = pct * (defaultShare / 100);
          if (goldVal > maxRewardValue) {
            maxRewardValue = goldVal;
            bestType = 'percentage';
            bestLabel = `${goldVal.toFixed(2).replace(/\.00$/, '')}% Gold`;
          }
        } else if (fixed > 0 && maxRewardValue === 0) {
          // Fixed commission: calculate gold share in currency
          // Only use if no percentage-based reward found yet
          const goldFixed = (fixed * (defaultShare / 100)).toFixed(0);
          if (parseFloat(goldFixed) > 0 && bestType === 'fixed') {
            bestLabel = `₹${goldFixed} Gold`;
          } else if (!bestLabel) {
            bestLabel = `₹${goldFixed} Gold`;
            bestType = 'fixed';
          }
        }
      });
    });

    return bestLabel;
  }
};

module.exports = RewardHighlightService;
