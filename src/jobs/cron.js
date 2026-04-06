const cron = require('node-cron');
const config = require('../config');
const { queues } = require('../config/redis');
const logger = require('../utils/logger');

const initCronJobs = () => {
  // Campaign sync based on .env config (default every 4 hours)
  cron.schedule(config.campaignSync.cron, async () => {
    logger.info('[Cron] Triggering campaign sync for INRDeals');
    await queues.campaignSync.add('sync-campaigns', {}, {
      removeOnComplete: true,
      jobId: `cron-sync-${Date.now()}`,
    });
  });

  // Scraper scheduler based on .env config
  /*
  cron.schedule(config.scraper.cron, async () => {
    logger.info('[Cron] Triggering scraper check');
    
    // We defer the actual DB check / queueing to a quick job,
    // or we do it inline here:
    try {
      const Platform = require('../models/Platform');
      const { ScraperJob, AdminConfig } = require('../models/AdminConfig');
      
      const adminCfg = await AdminConfig.findOne({ key: 'global' });
      if (!adminCfg?.flags?.scrapingEnabled) {
        logger.info('[Cron] Scraping is globally disabled via admin config');
        return;
      }
      
      const platforms = await Platform.find({ isActive: true }).lean();
      logger.info(`[Cron] Queueing scrape jobs for ${platforms.length} active platforms`);

      for (const platform of platforms) {
        const job = await ScraperJob.create({
          platformId: platform._id,
          platformName: platform.name,
          triggeredBy: 'cron',
          status: 'queued',
        });

        await queues.scrapeJobs.add('scrape-platform', {
          platformId: platform._id.toString(),
          platformSlug: platform.slug,
          jobId: job._id.toString(),
        }, {
          attempts: 2,
          backoff: { type: 'fixed', delay: 10000 },
          delay: Math.random() * 60000, // stagger up to 1 min
        });
      }
    } catch (err) {
      logger.error(`[Cron] Scheduled scraper error: ${err.message}`);
    }
  });
  */

  logger.info(`[Cron] Initialized with schedules: SYNC(${config.campaignSync.cron})`);
};

module.exports = { initCronJobs };
