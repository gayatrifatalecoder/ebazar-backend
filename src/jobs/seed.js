/**
 * Seed script — run once to bootstrap the database
 * node src/jobs/seed.js
 */
require('dotenv').config();
const { connect } = require('../config/database');
const { AdminConfig } = require('../models/AdminConfig');
const logger = require('../utils/logger');

const INITIAL_CATEGORY_MAPPINGS = [
  { ourCategory: 'fashion',     ourCategoryLabel: 'Fashion',         inrDealsSlabLabel: 'Apparel New & Old',                      isNewUserSlab: false, displayOrder: 1 },
  { ourCategory: 'beauty',      ourCategoryLabel: 'Beauty',          inrDealsSlabLabel: 'Beauty & Personal Care (New)',            isNewUserSlab: true,  displayOrder: 2 },
  { ourCategory: 'footwear',    ourCategoryLabel: 'Footwear',        inrDealsSlabLabel: 'Footwear & Kidswear (New)',               isNewUserSlab: true,  displayOrder: 3 },
  { ourCategory: 'home',        ourCategoryLabel: 'Home & Kitchen',  inrDealsSlabLabel: 'Home & Kitchen (New)',                   isNewUserSlab: true,  displayOrder: 4 },
  { ourCategory: 'kids',        ourCategoryLabel: 'Kids',            inrDealsSlabLabel: 'Footwear & Kidswear (New)',               isNewUserSlab: true,  displayOrder: 5 },
  { ourCategory: 'jewellery',   ourCategoryLabel: 'Jewellery',       inrDealsSlabLabel: 'Ethnic (Jewellery, Western, Fine) & Accessories', isNewUserSlab: false, displayOrder: 6 },
  { ourCategory: 'accessories', ourCategoryLabel: 'Accessories',     inrDealsSlabLabel: 'Ethnic (Jewellery, Western, Fine) & Accessories', isNewUserSlab: false, displayOrder: 7 },
  { ourCategory: 'sports',      ourCategoryLabel: 'Sports',          inrDealsSlabLabel: 'Apparel New & Old',                      isNewUserSlab: false, displayOrder: 8 },
];

const DEFAULT_ADMIN_CONFIG = {
  key: 'global',
  defaultGoldPercent: 10,
  categoryMappings: INITIAL_CATEGORY_MAPPINGS,
  goldRules: [
    // Example: Beauty gets 15% of commission as gold (higher to incentivize)
    {
      commissionSlabLabel: 'Beauty & Personal Care (New)',
      goldPercent: 15,
      isActive: true,
    },
    {
      commissionSlabLabel: 'Home & Kitchen (New)',
      goldPercent: 12,
      isActive: true,
    },
  ],
  flags: {
    scrapingEnabled: true,
    goldEnabled: true,
    newUserSlabEnabled: true,
  },
};

async function seed() {
  await connect();
  logger.info('Connected to MongoDB, seeding...');

  // Upsert AdminConfig
  await AdminConfig.findOneAndUpdate(
    { key: 'global' },
    { $setOnInsert: DEFAULT_ADMIN_CONFIG },
    { upsert: true, new: true }
  );
  logger.info('AdminConfig seeded');

  logger.info('Seed complete. Run campaign sync to populate platforms:');
  logger.info('  POST /api/admin/sync/campaigns');
  process.exit(0);
}

seed().catch(err => {
  logger.error(`Seed failed: ${err.message}`);
  process.exit(1);
});
