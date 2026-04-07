const Queue = require('bull');
const Redis = require('ioredis');
const config = require('./index');
const logger = require('../utils/logger');

const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

const redisClient = new Redis(config.redisUrl, redisOptions);
const subscriberClient = new Redis(config.redisUrl, redisOptions);

const attachRedisEvents = (client, name) => {
  let errorLogged = false;
  client.on('connect', () => {
    errorLogged = false;
    logger.info(`[Redis - ${name}] Connected successfully.`);
  });
  client.on('error', (err) => {
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
      if (!errorLogged) {
        logger.warn(`[Redis - ${name}] Connection failed: ${err.message}. (Is Redis running?) Retrying...`);
        errorLogged = true;
      }
    } else {
      logger.error(`[Redis - ${name}] Error: ${err.message}`);
    }
  });
};

attachRedisEvents(redisClient, 'Main');
attachRedisEvents(subscriberClient, 'Subscriber');

const createQueue = (name) => {
  return new Queue(name, {
    createClient: (type) => {
      switch (type) {
        case 'client':
          return redisClient;
        case 'subscriber':
          return subscriberClient;
        default:
          return new Redis(config.redisUrl, redisOptions);
      }
    },
  });
};

const queues = {
  campaignSync: createQueue('campaignSync'),
  scrapeJobs: createQueue('scrapeJobs'),
  goldCredits: createQueue('goldCredits'),
  linkTracking: createQueue('linkTracking'),
  scraperIngestion: createQueue('scraperIngestion'),
};

const cache = {
  async get(key) {
    try {
      if (redisClient.status !== 'ready') return null;
      const val = await redisClient.get(key);
      return val ? JSON.parse(val) : null;
    } catch (err) {
      return null;
    }
  },
  async set(key, value, ttlSeconds = null) {
    try {
      if (redisClient.status !== 'ready') return;
      if (ttlSeconds) {
        await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      } else {
        await redisClient.set(key, JSON.stringify(value));
      }
    } catch (err) {}
  },
  async delPattern(pattern) {
    try {
      if (redisClient.status !== 'ready') {
        console.warn(`[Cache] Redis not ready, skipping cache bust for: ${pattern}`);
        return;
      }
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch (err) {
      console.error(`[Cache] Error clearing pattern ${pattern}:`, err.message);
    }
  }
};

module.exports = { queues, cache, redisClient };
