const Queue = require('bull');
const Redis = require('ioredis');
const config = require('./index');

const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

const redisClient = new Redis(config.redisUrl, redisOptions);
const subscriberClient = new Redis(config.redisUrl, redisOptions);

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
};

const cache = {
  async get(key) {
    const val = await redisClient.get(key);
    return val ? JSON.parse(val) : null;
  },
  async set(key, value, ttlSeconds = null) {
    if (ttlSeconds) {
      await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } else {
      await redisClient.set(key, JSON.stringify(value));
    }
  },
  async delPattern(pattern) {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  }
};

module.exports = { queues, cache, redisClient };
