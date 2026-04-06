require('dotenv').config();
const mongoose = require('mongoose');
const config = require('./src/config');
const CampaignSyncService = require('./src/services/campaignSyncService');

async function testSync() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log("MongoDB Connected");
    
    console.log("Running syncAllCampaigns...");
    const result = await CampaignSyncService.syncAllCampaigns();
    console.log("Final Result:", result);
  } catch(e) {
    console.error("Error:", e);
  } finally {
    process.exit(0);
  }
}

testSync();
