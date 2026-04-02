const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

/**
 * Product = scraped from Myntra/Nykaa etc., mapped to INRDeals platform/slab
 * Category is manually mapped at scraper level (since INRDeals gives none)
 * commissionSlabLabel links to Platform.commissionSlabs for gold calculation
 */
const ProductSchema = new mongoose.Schema({
  platformId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Platform',
    required: true,
    index: true,
  },
  inrDealsId: { type: String, index: true }, // platform's inrDealsId (denormalized for fast query)

  // Scraped product data
  title: { type: String, required: true },
  brand: { type: String },
  description: { type: String },
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  discountPercent: { type: Number },
  currency: { type: String, default: 'INR' },
  imageUrls: [{ type: String }],             // multiple images
  primaryImageUrl: { type: String },
  productUrl: { type: String, required: true }, // original URL on platform
  rating: { type: Number },
  reviewCount: { type: Number },
  availability: {
    type: String,
    enum: ['in_stock', 'out_of_stock', 'limited'],
    default: 'in_stock',
  },

  // Category — manually mapped at scraper/backend level
  // Maps to INRDeals commissionSlabs label for correct gold calculation
  category: {
    type: String,
    required: true,
    index: true,
    // e.g. "fashion", "beauty", "home", "footwear", "kids", "jewellery"
  },
  subcategory: { type: String },

  // Commission slab mapping — which INRDeals slab applies to this product
  // Matched from Platform.commissionSlabs based on category
  commissionSlabLabel: { type: String },     // e.g. "Beauty & Personal Care (New)"
  commissionPercent: { type: Number },       // actual % (e.g. 6.48)
  isNewUser: { type: Boolean, default: null }, // null = unknown, true = "New" slab applies

  // Admin controlled
  isTrending: { type: Boolean, default: false, index: true },
  isFeatured: { type: Boolean, default: false, index: true },
  isActive: { type: Boolean, default: true, index: true },
  displayBoost: { type: Number, default: 0 }, // admin can boost ranking

  // Scrape metadata
  scrapedAt: { type: Date, default: Date.now },
  scrapedBy: { type: String },              // scraper job ID
  scrapeSource: { type: String },           // "myntra_listing_scraper_v1"

  // De-duplication
  productFingerprint: { type: String, unique: true, sparse: true },
  // MD5 of (platformId + productUrl) to avoid duplicates
}, {
  timestamps: true,
  toJSON: { virtuals: true },
});

ProductSchema.plugin(mongoosePaginate);

// Indexes for common queries
ProductSchema.index({ platformId: 1, category: 1, isActive: 1 });
ProductSchema.index({ isTrending: 1, isActive: 1 });
ProductSchema.index({ isFeatured: 1, isActive: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ discountPercent: -1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ title: 'text', brand: 'text' }); // full-text search

// Auto-calc discount percent before save
ProductSchema.pre('save', function (next) {
  if (this.originalPrice && this.price && this.originalPrice > this.price) {
    this.discountPercent = Math.round(
      ((this.originalPrice - this.price) / this.originalPrice) * 100
    );
  }
  next();
});

module.exports = mongoose.model('Product', ProductSchema);
