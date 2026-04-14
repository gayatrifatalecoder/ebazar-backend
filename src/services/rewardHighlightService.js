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
   * Get the best gold reward badge for a specific platform object
   */
  getPlatformBadge(platform, region = 'IN') {
    // 1. Check custom rules first
    if (platform.goldRewardRules && platform.goldRewardRules.length > 0) {
      const activeRules = platform.goldRewardRules.filter(r => r.region === region && r.isActive);
      if (activeRules.length > 0) {
        let bestRule = activeRules[0];
        activeRules.forEach(r => {
          if (this.isBetterReward(r, bestRule)) bestRule = r;
        });
        return this.formatRewardLabel(bestRule);
      }
    }

    // 2. Fallback to default payout calculation
    const payoutStr = platform.tier?.payout;
    if (payoutStr) {
      // Try to extract number from "Flat 3.6%" or "Up to 10%"
      const match = payoutStr.match(/(\d+(\.\d+)?)/);
      if (match) {
        const val = parseFloat(match[1]);
        const share = platform.goldConfig?.defaultGoldPercent || 10;
        const reward = (val * (share / 100)).toFixed(2);
        return `${reward}% Gold`;
      }
      return `${payoutStr} Reward`;
    }

    return null;
  }
};

module.exports = RewardHighlightService;
