const mongoose = require('mongoose');

/**
 * AffiliateClick — logged every time a user taps a product link
 * ref is passed to INRDeals so we can match the webhook back to this click
 */
const AffiliateClickSchema = new mongoose.Schema({
  // User (from Oxy auth JWT)
  userId: { type: String, required: true, index: true },

  // What was clicked
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  platformId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Platform',
    required: true,
  },
  inrDealsId: { type: String, required: true }, // platform's INRDeals ID

  // Commission data at time of click (Snapshot - important for multi-region)
  commissionSlabLabel: { type: String },
  commissionPercent: { type: Number },
  
  region: { type: String, enum: ['IN', 'AE'], default: 'IN' },
  rewardType: { 
    type: String, 
    enum: ['percentage_of_commission', 'fixed_amount', 'fixed_grams'], 
    default: 'percentage_of_commission' 
  },
  rewardValue: { type: Number }, // Snapshot of the promised value
  currency: { type: String, enum: ['INR', 'AED', 'GRAMS'] },

  // Link
  ref: { type: String, required: true, unique: true, index: true }, // our tracking ref
  generatedUrl: { type: String, required: true },  // full affiliate URL sent to user
  originalProductUrl: { type: String },

  // Resolution
  status: {
    type: String,
    enum: ['clicked', 'converted', 'expired', 'invalid'],
    default: 'clicked',
    index: true,
  },
  convertedAt: { type: Date },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
  },

  // Device/meta
  userAgent: { type: String },
  ipHash: { type: String }, // hashed for privacy
  clickedAt: { type: Date, default: Date.now, index: true },
}, {
  timestamps: true,
});

AffiliateClickSchema.index({ userId: 1, clickedAt: -1 });
AffiliateClickSchema.index({ inrDealsId: 1, status: 1 });

const AffiliateClick = mongoose.model('AffiliateClick', AffiliateClickSchema);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transaction — created when INRDeals webhook confirms a purchase
 * One transaction per webhook event (idempotent by inrDealsRef)
 */
const TransactionSchema = new mongoose.Schema({
  // User
  userId: { type: String, required: true, index: true },

  // References
  clickId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AffiliateClick',
  },
  platformId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Platform',
  },
  inrDealsId: { type: String },           // platform's INRDeals ID

  // INRDeals webhook data
  inrDealsRef: { type: String, unique: true, index: true }, // their transaction ref
  webhookEvent: { type: String },         // "sale", "lead" etc.
  orderValue: { type: Number, required: true },
  currency: { type: String, default: 'INR' },

  // Commission calculation
  commissionSlabLabel: { type: String },
  commissionPercent: { type: Number },
  commissionAmount: { type: Number },     // orderValue * commissionPercent / 100

  // Gold calculation
  rewardType: { type: String },
  rewardValue: { type: Number },          // Snapshot value used for calculation
  goldPercent: { type: Number },          // For percentage_of_commission cases
  goldAmount: { type: Number },           // Final gold value in local currency (INR/AED)
  goldGrams: { type: Number },            // Weight in grams (if applicable)
  region: { type: String, enum: ['IN', 'AE'] },

  // Gold reward status
  goldStatus: {
    type: String,
    enum: ['pending', 'processing', 'credited', 'failed', 'reversed'],
    default: 'pending',
    index: true,
  },
  goldCreditedAt: { type: Date },
  goldFailureReason: { type: String },
  goldRetryCount: { type: Number, default: 0 },

  // INRDeals transaction lifecycle
  inrDealsStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected', 'on_hold'],
    default: 'pending',
    index: true,
  },

  // Raw webhook payload (keep for audit/debugging)
  webhookPayload: { type: mongoose.Schema.Types.Mixed },
  webhookReceivedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ goldStatus: 1, createdAt: -1 });
TransactionSchema.index({ inrDealsStatus: 1 });

const Transaction = mongoose.model('Transaction', TransactionSchema);

module.exports = { AffiliateClick, Transaction };
