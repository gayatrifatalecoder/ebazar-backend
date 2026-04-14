const mongoose = require('mongoose');
const Category = require('../models/Category');
const Platform = require('../models/Platform');
require('dotenv').config();

const seedSampleRewards = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ebazar';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // 1. Fetch Categories
    const categories = await Category.find({ level: 1 });
    if (categories.length === 0) {
      console.log('No categories found. Please seed categories first.');
      process.exit(0);
    }

    // 2. Fetch some platforms
    let platforms = await Platform.find({ isActive: true }).limit(10);
    if (platforms.length === 0) {
      console.log('No active platforms found. Activating the first 10 platforms for testing...');
      const allPlatforms = await Platform.find().limit(10);
      for (const p of allPlatforms) {
        p.isActive = true;
        await p.save();
      }
      platforms = allPlatforms;
    }

    console.log(`Setting up sample rewards for ${platforms.length} platforms across ${categories.length} categories...`);

    // 3. Clear existing rules to avoid clutter for this demo (Optional but cleaner for testing)
    // await Platform.updateMany({}, { $set: { goldRewardRules: [], systemCategoryMappings: [] } });

    for (const [i, category] of categories.entries()) {
      // Pick 2-3 platforms to "compete" for this category
      const platformIdx1 = i % platforms.length;
      const platformIdx2 = (i + 1) % platforms.length;
      
      const p1 = platforms[platformIdx1];
      const p2 = platforms[platformIdx2];

      // Add a rule to p1
      const rule1 = {
        region: 'IN',
        slabLabel: 'On Successful Sale', // Common label
        systemCategoryId: category._id,
        rewardType: 'percentage_of_commission',
        rewardValue: 10 + (i % 5), // Varying percentages
        currency: 'INR',
        isActive: true
      };

      // Add a better rule to p2
      const rule2 = {
        region: 'IN',
        slabLabel: 'On Successful Sale',
        systemCategoryId: category._id,
        rewardType: 'percentage_of_commission',
        rewardValue: 12 + (i % 5), // Slightly better
        currency: 'INR',
        isActive: true
      };

      // Push rules
      await Platform.findByIdAndUpdate(p1._id, { $push: { goldRewardRules: rule1 } });
      await Platform.findByIdAndUpdate(p2._id, { $push: { goldRewardRules: rule2 } });
      
      console.log(`Linked ${p1.name} and ${p2.name} to category: ${category.name}`);
    }

    console.log('Sample rewards seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding rewards:', err);
    process.exit(1);
  }
};

seedSampleRewards();
