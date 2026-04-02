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
    const product = await Product.findById(productId).lean();
    if (!product || !product.isActive) {
      throw new Error('Product not found or inactive');
    }

    const platform = await Platform.findById(product.platformId).lean();
    if (!platform || !platform.isActive) {
      throw new Error('Platform not found or inactive');
    }

    // Resolve gold percent for this platform/slab
    const goldPercent = await this.resolveGoldPercent(
      platform._id,
      product.commissionSlabLabel
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
      goldPercent,
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
      goldPercent
    );

    return {
      affiliateUrl,
      ref,
      estimatedGold: estimatedGoldRange,
    };
  },

  /**
   * Resolve gold percent for a platform + slab combo
   * Priority: specific rule → platform default → global default
   */
  async resolveGoldPercent(platformId, slabLabel) {
    const cacheKey = `ebazar:gold_pct:${platformId}:${slabLabel}`;
    const cached = await cache.get(cacheKey);
    if (cached !== null) return cached;

    const adminConfig = await AdminConfig.findOne({ key: 'global' }).lean();
    if (!adminConfig) return 10; // fallback

    // Try specific rule for platform + slab
    const specificRule = adminConfig.goldRules?.find(r =>
      r.platformId?.toString() === platformId.toString() &&
      r.commissionSlabLabel === slabLabel &&
      r.isActive
    );
    if (specificRule) {
      await cache.set(cacheKey, specificRule.goldPercent, 300);
      return specificRule.goldPercent;
    }

    // Try platform-level rule
    const platformRule = adminConfig.goldRules?.find(r =>
      r.platformId?.toString() === platformId.toString() &&
      !r.commissionSlabLabel &&
      r.isActive
    );
    if (platformRule) {
      await cache.set(cacheKey, platformRule.goldPercent, 300);
      return platformRule.goldPercent;
    }

    const defaultPct = adminConfig.defaultGoldPercent || 10;
    await cache.set(cacheKey, defaultPct, 300);
    return defaultPct;
  },

  /**
   * Estimate gold user will earn
   * Gold = orderValue × commissionPercent/100 × goldPercent/100
   * We return a range since we don't know exact order value at click time
   */
  estimateGold(productPrice, commissionPercent, goldPercent) {
    if (!commissionPercent || !goldPercent) return { min: 0, max: 0 };
    const commission = (productPrice * commissionPercent) / 100;
    const gold = (commission * goldPercent) / 100;
    return {
      min: Math.floor(gold * 0.8), // account for validation rate
      max: Math.ceil(gold),
      exact: parseFloat(gold.toFixed(2)),
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
