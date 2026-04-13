const Category = require('../models/Category');
const SYSTEM_CATEGORIES = require('../config/categories');
const logger = require('../utils/logger');

const seedCategories = async () => {
  try {
    const count = await Category.countDocuments();
    if (count === 0) {
      logger.info('Categories collection is empty. Seeding single-collection tree...');

      for (const cat of SYSTEM_CATEGORIES) {
        
        // 1. Create Parent Category (Level 1)
        const parentCategory = await Category.create({
          name: cat.name,
          slug: cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          level: 1,
          parentId: null,
          isLeaf: false,
          displayOrder: cat.id
        });

        // 2. Add Parent ID to its own Path
        parentCategory.path = [parentCategory._id];
        await parentCategory.save();

        // 3. Create Subcategories (Level 2)
        const subcategoriesToInsert = cat.subcategories.map((subName, idx) => {
          const subId = new (require('mongoose').Types.ObjectId)();
          const subSlug = subName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          return {
            _id: subId,
            name: subName,
            slug: `${parentCategory.slug}-${subSlug}`,
            level: 2,
            parentId: parentCategory._id,
            path: [parentCategory._id, subId],
            isLeaf: true,
            displayOrder: idx
          };
        });

        await Category.insertMany(subcategoriesToInsert);
      }
      logger.info('Successfully seeded Adjacency List categories!');
    }
  } catch (err) {
    logger.error(`Failed to seed categories: ${err.message}`);
  }
};

module.exports = { seedCategories };
