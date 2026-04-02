const mongoose = require('mongoose');

/**
 * AdminConfig — singleton-style document per key
 * Stores global settings the admin panel controls
 */
const GoldRuleSchema = new mongoose.Schema({
  platformId: { type: mongoose.Schema.Types.ObjectId, ref: 'Platform' },
  inrDealsId: { type: String },
  commissionSlabLabel: { type: String },  // matches Platform.commissionSlabs[].label
  goldPercent: { type: Number, required: true }, // % of commission given as gold
  minOrderValue: { type: Number, default: 0 },
  maxGoldPerTransaction: { type: Number }, // cap
  isActive: { type: Boolean, default: true },
}, { _id: false });

/**
 * CategoryMapping — maps our internal category slugs to INRDeals slab labels
 * Since scraped data has no category, scraper assigns our slug, 
 * this maps it to the correct commission slab for gold calculation
 */
const CategoryMappingSchema = new mongoose.Schema({
  ourCategory: { type: String, required: true },     // "beauty"
  ourCategoryLabel: { type: String },                // "Beauty & Skincare"
  inrDealsSlabLabel: { type: String, required: true }, // "Beauty & Personal Care (New)"
  isNewUserSlab: { type: Boolean, default: false },
  iconUrl: { type: String },
  displayOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { _id: false });

const AdminConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // e.g. "global", "gold_rules"

  // Platform display order (admin drags to reorder)
  platformOrder: [{
    platformId: { type: mongoose.Schema.Types.ObjectId, ref: 'Platform' },
    displayOrder: { type: Number },
    isFeatured: { type: Boolean, default: false },
    isVisible: { type: Boolean, default: true },
  }],

  // Gold rules — override per platform/slab
  goldRules: [GoldRuleSchema],

  // Default gold percent if no specific rule matches
  defaultGoldPercent: { type: Number, default: 10 },

  // Category mappings (our slug → INRDeals slab)
  categoryMappings: [CategoryMappingSchema],

  // Feature flags
  flags: {
    scrapingEnabled: { type: Boolean, default: true },
    goldEnabled: { type: Boolean, default: true },
    newUserSlabEnabled: { type: Boolean, default: true },
  },

  updatedBy: { type: String }, // userId of admin
}, {
  timestamps: true,
});

const AdminConfig = mongoose.model('AdminConfig', AdminConfigSchema);

// ─────────────────────────────────────────────────────────────────────────────
// ScraperJob — tracks each scraping run per platform

const ScraperJobSchema = new mongoose.Schema({
  platformId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Platform',
    required: true,
    index: true,
  },
  platformName: { type: String },
  status: {
    type: String,
    enum: ['queued', 'running', 'completed', 'failed', 'partial'],
    default: 'queued',
    index: true,
  },
  triggeredBy: {
    type: String,
    enum: ['cron', 'manual', 'admin'],
    default: 'cron',
  },
  startedAt: { type: Date },
  completedAt: { type: Date },
  productsScraped: { type: Number, default: 0 },
  productsUpserted: { type: Number, default: 0 },
  productsFailed: { type: Number, default: 0 },
  pagesProcessed: { type: Number, default: 0 },
  errorLog: [{ type: String }],
  durationMs: { type: Number },
}, {
  timestamps: true,
});

const ScraperJob = mongoose.model('ScraperJob', ScraperJobSchema);

module.exports = { AdminConfig, ScraperJob };
