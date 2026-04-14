const Category = require('../models/Category');
const Platform = require('../models/Platform');
const RewardHighlightService = require('../services/rewardHighlightService');

const CategoryController = {
  /**
   * GET /categories
   * Returns a list of all main categories (level: 1).
   */
  async getAllCategories(req, res) {
    try {
      const region = req.query.region || 'IN'; // Get region from query or default
      const [categories, highlights] = await Promise.all([
        Category.find({ level: 1, isActive: true }).sort('displayOrder').lean(),
        RewardHighlightService.getCategoryHighlights(region)
      ]);

      const data = categories.map(cat => ({
        ...cat,
        maxGoldReward: highlights[cat._id.toString()] || null
      }));

      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * GET /categories/:id/subcategories
   * Returns subcategories for a specific parent category ID.
   */
  async getSubcategories(req, res) {
    try {
      const parentId = req.params.id;
      
      const subcategories = await Category.find({ 
        parentId, 
        isActive: true 
      }).sort('displayOrder').lean();

      if (!subcategories || subcategories.length === 0) {
        return res.status(404).json({ success: false, message: 'No subcategories found for this category' });
      }

      res.json({ success: true, data: subcategories });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * GET /categories/tree
   * Returns the entire nested category JSON (Best used for sending payload to Python scraper).
   */
  async getCategoryTree(req, res) {
    try {
      const region = req.query.region || 'IN';
      
      const [tree, highlights] = await Promise.all([
        Category.aggregate([
          { $match: { level: 1, isActive: true } },
          { $sort: { displayOrder: 1 } },
          {
            $lookup: {
              from: 'categories',
              localField: '_id',
              foreignField: 'parentId',
              as: 'subcategories'
            }
          }
        ]),
        RewardHighlightService.getCategoryHighlights(region)
      ]);

      tree.forEach(cat => {
        cat.maxGoldReward = highlights[cat._id.toString()] || null;
        if (cat.subcategories) {
          cat.subcategories.sort((a, b) => a.displayOrder - b.displayOrder);
        }
      });

      res.json({ success: true, data: tree });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * GET /categories/:id/platforms
   * Returns platforms configured for a specific Category ID.
   */
  async getPlatformsByCategory(req, res) {
    try {
      const categoryId = req.params.id;
      const category = await Category.findById(categoryId).lean();

      if (!category) {
        return res.status(404).json({ success: false, message: 'Category not found' });
      }

      // Query Platforms where the systemMappings match this Category Name
      const platforms = await Platform.find({
        isActive: true,
        'systemCategoryMappings.systemCategory': category.name
      }).sort('displayOrder').lean();

      res.json({ success: true, data: platforms });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = CategoryController;
