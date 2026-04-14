const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

/**
 * Commission Slab Schema inside Tier
 */
const CommissionSlabSchema = new mongoose.Schema({
  label: { type: String },          // "Beauty & Personal Care (New)"
  terms: { type: String, default: null },
  commission: [{
    max: { type: Number },
    min: { type: Number },
    fixed: { type: Number },
    limit: { type: Number, default: null },
    percentage: { type: Number }
  }],
  categoryKeys: [{ type: String }], // mapped subcategory slugs for backend matching
}, { _id: false });

/**
 * Ebazar Gold Reward Rule
 * Defines how much gold to give back for a specific INRDeals slab in a specific region
 */
const GoldRewardRuleSchema = new mongoose.Schema({
  region: { 
    type: String, 
    enum: ['IN', 'AE'], 
    required: true, 
    index: true 
  }, // India or UAE
  slabLabel: { type: String, required: true }, // Links to platform.tier.slabs[].label
  systemCategoryId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category',
    index: true
  }, // Map to our 11 categories for UI badges
  
  rewardType: { 
    type: String, 
    enum: ['percentage_of_commission', 'fixed_amount', 'fixed_grams'], 
    default: 'percentage_of_commission' 
  },
  rewardValue: { type: Number, required: true }, // 10 (%) or 50 (INR/AED) or 0.001 (g)
  currency: { type: String, enum: ['INR', 'AED', 'GRAMS'], default: 'INR' },
  
  isActive: { type: Boolean, default: true }
}, { _id: false });

/**
 * Platform = one store/brand on INRDeals (e.g. Myntra, Nykaa)
 */
const PlatformSchema = new mongoose.Schema({
  // From INRDeals - Core
  inrDealsId: { type: String, required: true, unique: true, index: true }, // "cXLVcq"
  name: { type: String, required: true },             // "Myntra"
  slug: { type: String, required: true, unique: true, index: true },
  description: { type: String },
  conversionRate: { type: String },
  access: { type: String },                           // "public"
  logoUrl: { type: String },                          // Overall platform logo
  status: { type: String },                           // "active"
  multistep: { type: Boolean, default: false },
  defaultUrl: { type: String },
  cookieDuration: { type: String },                   // "30"
  clickAttribution: { type: String, default: 'last' },

  // Custom Regions & Type
  regions: [{
    code: String,
    name: String
  }],
  type: {
    name: String                                      // "CPS"
  },

  // Store metadata
  store: {
    url: String,
    name: String,
    logo_url: String,                                 // often the high res store logo
    playstore: String,
    applestore: String
  },

  // Categories & Subcategories directly mapped from INRDeals response
  categories: [{
    id: String,
    name: String
  }],
  subcategories: [{
    name: String
  }],

  // Detailed Tiers
  tier: {
    slabs: [CommissionSlabSchema],
    terms: {
      media: { type: mongoose.Schema.Types.Mixed },     // {sms: true, adult: false...}
      tracking: { type: mongoose.Schema.Types.Mixed },  // {desktop: true, mobile_web: true...}
      additional: { type: mongoose.Schema.Types.Mixed }
    },
    config: {
      payment_time: String,
      reporting_time: String,
      validation_rate: Number,
      validation_time: String,
      missing_transaction: Boolean,
      transaction_visibility: String
    },
    payout: String,
    deeplink: Boolean
  },

  // Map Platform's INRDeals Slabs down to our Generic System Categories
  systemCategoryMappings: [{
    slabLabel: { type: String, required: true },       // e.g. "Tablets, Computer peripherals, Laptop netbooks"
    systemCategory: { type: String, required: true },  // e.g. "Electronics"
    systemSubcategory: { type: String },               // e.g. "Smartphones & Tablets"
    isActive: { type: Boolean, default: true }         // Admin flag to disable certain slab associations
  }],

  // Admin controlled fields (Should not be overwritten by Sync)
  displayOrder: { type: Number, default: 0, index: true }, // lower = shown first
  isActive: { type: Boolean, default: true, index: true }, // whether it shows in FRONTEND
  isFeatured: { type: Boolean, default: false },

  // Admin-defined rules for how much GOLD to give back from each slab (Region-Aware)
  goldRewardRules: [GoldRewardRuleSchema],

  // Gold config 
  goldConfig: {
    defaultGoldPercent: { type: Number, default: 10 },    // % of our commission = gold
    isGoldEnabled: { type: Boolean, default: true },
  },

  // Sync tracking mechanics
  inventoryIdUsed: { type: String },                      // The inventory ID used to fetch it
  lastSyncedAt: { type: Date, default: Date.now },
  syncStatus: {
    type: String,
    enum: ['pending', 'synced', 'error'],
    default: 'pending',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
});

PlatformSchema.plugin(mongoosePaginate);

// Virtual: total active products
PlatformSchema.virtual('productCount', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'platformId',
  count: true,
});

PlatformSchema.index({ displayOrder: 1, isActive: 1 });
PlatformSchema.index({ isFeatured: 1, isActive: 1 });

module.exports = mongoose.model('Platform', PlatformSchema);
