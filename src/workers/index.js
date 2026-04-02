const { queues } = require('../config/redis');
const GoldService = require('../services/goldService');
const MyntraScraper = require('../services/myntraScraper');
const Platform = require('../models/Platform');
const { ScraperJob } = require('../models/AdminConfig');
const CampaignSyncService = require('../services/campaignSyncService');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// GOLD CREDIT WORKER
// ─────────────────────────────────────────────────────────────────────────────
queues.goldCredits.process('credit-gold', 5, async (job) => {
  logger.info(`[GoldWorker] Processing job ${job.id}: ${JSON.stringify(job.data)}`);
  return GoldService.creditGold(job.data);
});

queues.goldCredits.on('completed', (job, result) => {
  logger.info(`[GoldWorker] Job ${job.id} completed: gold=${result?.goldAmount}`);
});

queues.goldCredits.on('failed', (job, err) => {
  logger.error(`[GoldWorker] Job ${job.id} failed (attempt ${job.attemptsMade}): ${err.message}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// SCRAPER WORKER
// ─────────────────────────────────────────────────────────────────────────────
const SCRAPERS = {
  myntra: MyntraScraper,
};

queues.scrapeJobs.process('scrape-platform', 2, async (job) => {
  const { platformId, platformSlug, jobId } = job.data;
  logger.info(`[ScraperWorker] Starting scrape: ${platformSlug} (job ${jobId})`);

  const platform = await Platform.findById(platformId).lean();
  if (!platform) throw new Error(`Platform not found: ${platformId}`);

  const scraper = SCRAPERS[platformSlug];
  if (!scraper) throw new Error(`No scraper implemented for: ${platformSlug}`);

  const stats = await scraper.run(platform, jobId);
  await cache.delPattern(`ebazar:products:${platformId}:*`);
  return stats;
});

queues.scrapeJobs.on('failed', async (job, err) => {
  logger.error(`[ScraperWorker] Job ${job.id} failed: ${err.message}`);
  const { jobId } = job.data;
  if (jobId) {
    await ScraperJob.findByIdAndUpdate(jobId, {
      status: 'failed',
      $push: { errorLog: err.message },
    }).catch(() => {});
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN SYNC WORKER
// ─────────────────────────────────────────────────────────────────────────────
queues.campaignSync.process('sync-campaigns', 1, async (job) => {
  logger.info('[CampaignSyncWorker] Starting campaign sync...');
  return CampaignSyncService.syncAllCampaigns();
});

queues.campaignSync.on('completed', (job, result) => {
  logger.info(`[CampaignSyncWorker] Sync complete: ${JSON.stringify(result)}`);
});

queues.campaignSync.on('failed', (job, err) => {
  logger.error(`[CampaignSyncWorker] Sync failed: ${err.message}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// LINK TRACKING WORKER 
// ─────────────────────────────────────────────────────────────────────────────
queues.linkTracking.process('track-click', 10, async (job) => {
  const { platformId } = job.data;
  await Platform.findByIdAndUpdate(platformId, { $inc: { 'stats.clickCount': 1 } })
    .catch(() => {});
  return { tracked: true };
});

logger.info('All Bull workers initialized and listening');

module.exports = { queues };
