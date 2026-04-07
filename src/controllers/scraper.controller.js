const { queues } = require('../config/redis');
const logger = require('../utils/logger');

const ingestProducts = async (req, res, next) => {
  try {
    const { products } = req.body;
    
    // Protect against massive payloads crashing in one job, 
    // but typically a scraper batch is 100-1000 items. Let the bull queue handle it.
    const job = await queues.scraperIngestion.add('ingest-batch', {
      products,
      timestamp: new Date().toISOString()
    }, {
      removeOnComplete: true, // Keep redis clean
      removeOnFail: false
    });

    logger.info(`[ScraperController] Accepted ${products.length} products. JobId: ${job.id}`);

    res.status(202).json({
      success: true,
      message: 'Batch accepted for processing',
      jobId: job.id,
      count: products.length
    });
  } catch (error) {
    logger.error(`[ScraperController] Error accepting batch: ${error.message}`);
    next(error);
  }
};

module.exports = { ingestProducts };
