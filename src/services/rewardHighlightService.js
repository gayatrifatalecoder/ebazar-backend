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
    }).select('name goldRewardRules').lean();

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
            label,
            platformName: platform.name,
            rule: {
              type: rule.rewardType,
              value: rule.rewardValue
            }
          };
        }
      });
    });

    // 3. Flatten for API response
    const result = Object.fromEntries(
      Object.entries(highlights).map(([catId, data]) => [catId, data.label])
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
   * Comparison logic to determine which reward is 'Better' for the badge
   * Percentages are compared directly. Fixed values are harder but we prioritize higher numbers.
   */
  isBetterReward(newRule, existingRule) {
    if (!existingRule) return true;
    
    // Percentage vs Percentage
    if (newRule.rewardType === 'percentage_of_commission' && existingRule.type === 'percentage_of_commission') {
      return newRule.rewardValue > existingRule.value;
    }
    
    // Grams are always highlighted well
    if (newRule.rewardType === 'fixed_grams') return true;
    
    // Simple fallback: Higher value is usually better UI
    return newRule.rewardValue > existingRule.value;
  }
};

module.exports = RewardHighlightService;
