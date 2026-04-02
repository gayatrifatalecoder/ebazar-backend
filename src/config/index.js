require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/ebazar',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  inrDeals: {
    baseUrl: process.env.INRDEALS_API_URL || 'https://api.linkinr.com',
    authKey: process.env.INRDEALS_AUTH_TOKEN || '49d3210d5fa7d82c3223112650682b96',
    inventoryId: process.env.INRDEALS_INVENTORY_ID || 'gyursI',
    affId: process.env.INRDEALS_AFF_ID || 'ebazar_default',
  },
  
  oxy: {
    authServiceUrl: process.env.OXY_AUTH_SVC || 'https://auth.oxy.app',
    serviceKey: process.env.OXY_SERVICE_KEY || 'dev_key',
  },
  
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100
  },

  campaignSync: {
    cron: process.env.CRON_SCHEDULE_SYNC || '0 */4 * * *',
  },
  
  scraper: {
    cron: process.env.CRON_SCHEDULE_SCRAPER || '0 */6 * * *',
  }
};
