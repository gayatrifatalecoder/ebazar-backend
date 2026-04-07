require('dotenv').config();
const mongoose = require('mongoose');
const CampaignSyncService = require('../src/services/campaignSyncService');
const Platform = require('../src/models/Platform');
const logger = require('../src/utils/logger');

async function testSync() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ebazar';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    const inrDealsId = 'Xxft0A'; // Amazon from user request
    logger.info(`Testing sync for platform: ${inrDealsId}`);

    const result = await CampaignSyncService.syncSingleCampaign(inrDealsId);
    
    // Check if tier.slabs exists and is not empty
    const updated = await Platform.findOne({ inrDealsId });
    if (updated && updated.tier && updated.tier.slabs && updated.tier.slabs.length > 0) {
      logger.info('SUCCESS: Tier slabs found! Count: ' + updated.tier.slabs.length);
      logger.info('First slab: ' + updated.tier.slabs[0].label);
    } else {
      logger.error('FAILURE: Tier slabs are still empty.');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

testSync();
