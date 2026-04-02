const crypto = require('crypto');
const { AffiliateClick, Transaction } = require('../models/AffiliateClick');
const Platform = require('../models/Platform');
const { queues } = require('../config/redis');
const config = require('../config');
const logger = require('../utils/logger');

const WebhookService = {
  /**
   * Verify INRDeals webhook signature
   * INRDeals signs the payload with HMAC-SHA256 using your webhook secret
   */
  verifySignature(rawBody, signatureHeader) {
    const expected = crypto
      .createHmac('sha256', config.inrDeals.webhookSecret)
      .update(rawBody)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signatureHeader || '', 'hex'),
        Buffer.from(expected, 'hex')
      );
    } catch {
      return false;
    }
  },

  /**
   * Process incoming purchase webhook from INRDeals
   *
   * Webhook payload shape (typical INRDeals CPS webhook):
   * {
   *   event: "sale",
   *   transaction_id: "TXN_abc123",
   *   campaign_id: "cXLVcq",
   *   ref: "ebz_Xk9...",          ← our tracking ref from click
   *   order_id: "ORD_xyz",
   *   order_value: 2499,
   *   currency: "INR",
   *   status: "confirmed",         ← or "pending", "rejected"
   *   commission_amount: 180,      ← INRDeals calculated (verify against our calc)
   *   created_at: "2026-04-02T10:00:00Z"
   * }
   */
  async processWebhook(payload) {
    const {
      event,
      transaction_id: inrDealsRef,
      campaign_id: inrDealsCampaignId,
      ref,                    // our ref from click
      order_value: orderValue,
      status,
      currency = 'INR',
      commission_amount: inrDealsCommission,
    } = payload;

    logger.info(`Webhook received: event=${event} ref=${ref} status=${status}`);

    // Idempotency check — if we've seen this transaction, skip
    const existing = await Transaction.findOne({ inrDealsRef });
    if (existing) {
      logger.warn(`Duplicate webhook for inrDealsRef: ${inrDealsRef}`);
      return { status: 'duplicate', transactionId: existing._id };
    }

    // Look up the affiliate click by our ref
    const click = await AffiliateClick.findOne({ ref });
    if (!click) {
      logger.error(`No click found for ref: ${ref}`);
      // Still record the transaction but without user binding
      await this.recordOrphanTransaction(payload);
      return { status: 'orphan', ref };
    }

    // Only credit gold for confirmed transactions
    // pending = log it; rejected = log it; confirmed = process gold
    const platform = await Platform.findById(click.platformId).lean();
    const commissionPercent = click.commissionPercent || 0;
    const commissionAmount = (orderValue * commissionPercent) / 100;
    const goldPercent = click.goldPercent || 10;
    const goldAmount = parseFloat(((commissionAmount * goldPercent) / 100).toFixed(2));

    // Create transaction record
    const transaction = await Transaction.create({
      userId: click.userId,
      clickId: click._id,
      platformId: click.platformId,
      inrDealsId: inrDealsCampaignId,
      inrDealsRef,
      webhookEvent: event,
      orderValue,
      currency,
      commissionSlabLabel: click.commissionSlabLabel,
      commissionPercent,
      commissionAmount,
      goldPercent,
      goldAmount,
      goldStatus: status === 'confirmed' ? 'pending' : 'processing',
      inrDealsStatus: status,
      webhookPayload: payload,
      webhookReceivedAt: new Date(),
    });

    // Update click status
    await AffiliateClick.findByIdAndUpdate(click._id, {
      status: status === 'confirmed' ? 'converted' : 'clicked',
      convertedAt: status === 'confirmed' ? new Date() : undefined,
      transactionId: transaction._id,
    });

    // Queue gold credit only for confirmed purchases
    if (status === 'confirmed' && goldAmount > 0) {
      await queues.goldCredits.add(
        'credit-gold',
        {
          transactionId: transaction._id.toString(),
          userId: click.userId,
          goldAmount,
          platformName: platform?.name,
          inrDealsRef,
        },
        {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        }
      );
      logger.info(`Gold job queued: userId=${click.userId} gold=${goldAmount} txn=${transaction._id}`);
    }

    return { status: 'processed', transactionId: transaction._id, goldAmount };
  },

  async recordOrphanTransaction(payload) {
    try {
      await Transaction.create({
        userId: 'UNKNOWN',
        inrDealsRef: payload.transaction_id,
        inrDealsId: payload.campaign_id,
        webhookEvent: payload.event,
        orderValue: payload.order_value || 0,
        currency: payload.currency || 'INR',
        commissionPercent: 0,
        commissionAmount: 0,
        goldAmount: 0,
        goldStatus: 'failed',
        goldFailureReason: 'No matching click found for ref',
        inrDealsStatus: payload.status,
        webhookPayload: payload,
      });
    } catch (err) {
      if (err.code !== 11000) throw err; // ignore duplicate
    }
  },

  /**
   * Handle status update webhooks (pending → confirmed → rejected)
   * INRDeals may send multiple events for the same transaction
   */
  async handleStatusUpdate(payload) {
    const { transaction_id: inrDealsRef, status } = payload;

    const transaction = await Transaction.findOne({ inrDealsRef });
    if (!transaction) return { status: 'not_found' };

    const statusMap = {
      confirmed: 'confirmed',
      rejected: 'rejected',
      on_hold: 'on_hold',
    };

    await Transaction.findByIdAndUpdate(transaction._id, {
      inrDealsStatus: statusMap[status] || status,
      webhookPayload: payload,
    });

    // If rejected and gold was credited — flag for reversal (manual process)
    if (status === 'rejected' && transaction.goldStatus === 'credited') {
      await Transaction.findByIdAndUpdate(transaction._id, {
        goldStatus: 'reversed',
        goldFailureReason: 'Transaction rejected by INRDeals after crediting',
      });
      logger.warn(`Gold reversal needed: txn=${transaction._id} user=${transaction.userId}`);
    }

    return { status: 'updated' };
  },
};

module.exports = WebhookService;
