const Category = require('../models/Category');
const SYSTEM_CATEGORIES = require('../config/categories');
const logger = require('../utils/logger');

const seedCategories = async () => {
  try {
    logger.info('Syncing categories with system config...');
    const mongoose = require('mongoose');

    for (const cat of SYSTEM_CATEGORIES) {
      // 1. Upsert Parent Category (Level 1)
      const parentSlug = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const parentCategory = await Category.findOneAndUpdate(
        { slug: parentSlug, level: 1 },
        {
          $set: {
            name: cat.name,
            image: cat.image,
            displayOrder: cat.id,
            parentId: null,
            isLeaf: false,
          }
        },
        { upsert: true, new: true }
      );

      // Ensure path is set for parent
      if (!parentCategory.path || parentCategory.path.length === 0) {
        parentCategory.path = [parentCategory._id];
        await parentCategory.save();
      }

      // 2. Sync Subcategories (Level 2)
      for (let idx = 0; idx < cat.subcategories.length; idx++) {
        const subItem = cat.subcategories[idx];
        // Handle both string and object formats for backward compatibility
        const isObject = typeof subItem === 'object';
        const subName = isObject ? subItem.name : subItem;
        const subImage = isObject ? subItem.image : null;

        const subSlug = `${parentSlug}-${subName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        
        await Category.findOneAndUpdate(
          { slug: subSlug, level: 2 },
          {
            $set: {
              name: subName,
              image: subImage,
              parentId: parentCategory._id,
              path: [parentCategory._id], // Temp path, will append next
              isLeaf: true,
              displayOrder: idx
            }
          },
          { upsert: true, new: true }
        ).then(async (sub) => {
          // Fix path to include self
          if (!sub.path.includes(sub._id)) {
            sub.path = [parentCategory._id, sub._id];
            await sub.save();
          }
        });
      }
    }
    logger.info('Categories sync completed successfully!');
  } catch (err) {
    logger.error(`Failed to seed categories: ${err.message}`);
  }
};

module.exports = { seedCategories };
