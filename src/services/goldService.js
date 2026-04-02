const axios = require('axios');
const { Transaction } = require('../models/AffiliateClick');
const config = require('../config');
const logger = require('../utils/logger');

const oxyGoldClient = axios.create({
  baseURL: config.oxy.goldApiUrl,
  timeout: 10000,
  headers: {
    'x-service-key': config.oxy.goldServiceKey,
    'x-service-name': 'ebazar',
    'Content-Type': 'application/json',
  },
});

const GoldService = {
  /**
   * Credit gold to a user for a confirmed purchase
   * Called by the Bull worker after webhook processing
   */
  async creditGold({ transactionId, userId, goldAmount, platformName, inrDealsRef }) {
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) throw new Error(`Transaction not found: ${transactionId}`);

    // Guard: don't double-credit
    if (transaction.goldStatus === 'credited') {
      logger.warn(`Gold already credited for txn: ${transactionId}`);
      return { alreadyCredited: true };
    }

    await Transaction.findByIdAndUpdate(transactionId, { goldStatus: 'processing' });

    try {
      const response = await oxyGoldClient.post('/credit', {
        user_id: userId,
        amount: goldAmount,
        source: 'ebazar',
        reference_id: transactionId,
        description: `E-Bazar purchase reward${platformName ? ` from ${platformName}` : ''}`,
        metadata: {
          inr_deals_ref: inrDealsRef,
          transaction_id: transactionId,
        },
      });

      await Transaction.findByIdAndUpdate(transactionId, {
        goldStatus: 'credited',
        goldCreditedAt: new Date(),
      });

      logger.info(`Gold credited: userId=${userId} amount=${goldAmount} txn=${transactionId}`);
      return { success: true, goldAmount, response: response.data };
    } catch (err) {
      const isRetryable = !err.response || err.response.status >= 500;

      await Transaction.findByIdAndUpdate(transactionId, {
        goldStatus: isRetryable ? 'pending' : 'failed',
        goldFailureReason: err.response?.data?.message || err.message,
        $inc: { goldRetryCount: 1 },
      });

      logger.error(`Gold credit failed: userId=${userId} txn=${transactionId} error=${err.message}`);
      if (isRetryable) throw err; // Bull will retry
      // Non-retryable (4xx) — don't throw, just log
      return { success: false, reason: err.message };
    }
  },

  /**
   * Get gold balance for a user (proxy to Oxy gold API)
   */
  async getBalance(userId) {
    const { data } = await oxyGoldClient.get(`/balance/${userId}`);
    return data;
  },

  /**
   * Get gold transaction history for a user
   */
  async getHistory(userId, page = 1, limit = 20) {
    const transactions = await Transaction.find({
      userId,
      goldStatus: { $in: ['credited', 'failed', 'reversed'] },
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('platformId', 'name logoUrl storeLogoUrl')
      .lean();

    return transactions.map(t => ({
      id: t._id,
      platform: t.platformId,
      orderValue: t.orderValue,
      goldAmount: t.goldAmount,
      goldStatus: t.goldStatus,
      creditedAt: t.goldCreditedAt,
      createdAt: t.createdAt,
    }));
  },
};

module.exports = GoldService;
