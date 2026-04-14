const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { AffiliateClick } = require('../models/AffiliateClick');
const Platform = require('../models/Platform');
const Product = require('../models/Product');
const INRDealsService = require('./inrDealsService');
const { AdminConfig } = require('../models/AdminConfig');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

const AffiliateLinkService = {
  /**
   * Main entry point: generate a trackable affiliate URL for a product
   * 1. Look up product + platform
   * 2. Resolve commission slab (for gold calculation snapshot)
   * 3. Generate INRDeals deeplink
   * 4. Log the click
   * Returns: { affiliateUrl, ref, estimatedGold }
   */
  async generateLink(userId, productId, meta = {}) {
    const region = meta.region || 'IN'; // Default to India if not provided
    const product = await Product.findById(productId).lean();
    if (!product || !product.isActive) {
      throw new Error('Product not found or inactive');
    }

    const platform = await Platform.findById(product.platformId).lean();
    if (!platform || !platform.isActive) {
      throw new Error('Platform not found or inactive');
    }

    // Resolve gold rule for this platform/slab/region
    const goldRule = await this.resolveGoldRule(
      platform._id,
      product.commissionSlabLabel,
      region
    );

    // Generate unique ref for this click
    const ref = this.generateRef(userId, productId);

    // Get deeplink from INRDeals
    let affiliateUrl;
    try {
      affiliateUrl = await INRDealsService.generateDeeplink(
        platform.inrDealsId,
        product.productUrl,
        ref
      );
    } catch (err) {
      logger.error(`Deeplink generation failed: ${err.message}`);
      throw new Error('Failed to generate affiliate link');
    }

    // Log the click (async — don't await to keep response fast)
    this.logClick({
      userId,
      productId: product._id,
      platformId: platform._id,
      inrDealsId: platform.inrDealsId,
      commissionSlabLabel: product.commissionSlabLabel,
      commissionPercent: product.commissionPercent,
      region,
      rewardType: goldRule.rewardType,
      rewardValue: goldRule.rewardValue,
      currency: goldRule.currency,
      ref,
      generatedUrl: affiliateUrl,
      originalProductUrl: product.productUrl,
      userAgent: meta.userAgent,
      ipHash: meta.ip ? crypto.createHash('sha256').update(meta.ip).digest('hex') : null,
    }).catch(err => logger.error(`Failed to log click: ${err.message}`));

    // Estimate gold for display in app
    const estimatedGoldRange = this.estimateGold(
      product.price,
      product.commissionPercent,
      goldRule
    );

    return {
      affiliateUrl,
      ref,
      estimatedGold: estimatedGoldRange,
    };
  },

  /**
   * Resolve gold rule for a platform + slab + region combo
   * Priority: Platform Specific Region Rule -> Platform Default -> Global Default
   */
  async resolveGoldRule(platformId, slabLabel, region) {
    const cacheKey = `ebazar:gold_rule:${platformId}:${slabLabel}:${region}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const platform = await Platform.findById(platformId).lean();
    
    // 1. Try to find a specific rule for this slab and region
    const specificRule = platform?.goldRewardRules?.find(r => 
      r.region === region && 
      r.slabLabel === slabLabel && 
      r.isActive
    );

    if (specificRule) {
      const rule = {
        rewardType: specificRule.rewardType,
        rewardValue: specificRule.rewardValue,
        currency: specificRule.currency
      };
      await cache.set(cacheKey, rule, 600);
      return rule;
    }

    // 2. Try to find a default rule for this region on the platform (if any)
    const platformDefault = platform?.goldRewardRules?.find(r => 
      r.region === region && 
      r.isActive
    );

    if (platformDefault) {
      const rule = {
        rewardType: platformDefault.rewardType,
        rewardValue: platformDefault.rewardValue,
        currency: platformDefault.currency
      };
      await cache.set(cacheKey, rule, 600);
      return rule;
    }

    // 3. Fallback to global defaults (backward compatibility)
    const adminConfig = await AdminConfig.findOne({ key: 'global' }).lean();
    const globalDefaultPct = adminConfig?.defaultGoldPercent || 10;
    
    return {
      rewardType: 'percentage_of_commission',
      rewardValue: globalDefaultPct,
      currency: region === 'IN' ? 'INR' : 'AED'
    };
  },

  /**
   * Estimate gold user will earn
   * Supports: Percentages, Fixed Weights (Grams), and Fixed Amounts
   */
  estimateGold(productPrice, commissionPercent, goldRule) {
    const { rewardType, rewardValue, currency } = goldRule;

    if (rewardType === 'fixed_amount') {
      return { min: rewardValue, max: rewardValue, exact: rewardValue, unit: currency };
    }

    if (rewardType === 'fixed_grams') {
      return { min: rewardValue, max: rewardValue, exact: rewardValue, unit: 'gGold' };
    }

    // Default Percent logic
    const commission = (productPrice * commissionPercent) / 100;
    const gold = (commission * rewardValue) / 100;
    return {
      min: Math.floor(gold * 0.8),
      max: Math.ceil(gold),
      exact: parseFloat(gold.toFixed(2)),
      unit: currency
    };
  },

  generateRef(userId, productId) {
    const random = uuidv4().replace(/-/g, '').slice(0, 8);
    const base = Buffer.from(`${userId.slice(-4)}${productId.toString().slice(-4)}`).toString('base64').slice(0, 6);
    return `ebz_${base}${random}`.slice(0, 24);
  },

  async logClick(clickData) {
    try {
      await AffiliateClick.create(clickData);
    } catch (err) {
      // Duplicate ref — shouldn't happen but swallow gracefully
      if (err.code === 11000) {
        logger.warn(`Duplicate click ref: ${clickData.ref}`);
      } else {
        throw err;
      }
    }
  },
};

module.exports = AffiliateLinkService;
