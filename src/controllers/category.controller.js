const Category = require('../models/Category');
const Platform = require('../models/Platform');

const CategoryController = {
  /**
   * GET /categories
   * Returns a list of all main categories (level: 1).
   */
  async getAllCategories(req, res) {
    try {
      const categories = await Category.find({ level: 1, isActive: true })
        .sort('displayOrder')
        .lean();

      res.json({ success: true, data: categories });
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
      // Aggregate approach to nest level 2 inside level 1
      const tree = await Category.aggregate([
        { $match: { level: 1, isActive: true } },
        { $sort: { displayOrder: 1 } },
        {
          $lookup: {
            from: 'categories', // The collection name in MongoDB for Category model
            localField: '_id',
            foreignField: 'parentId',
            as: 'subcategories'
          }
        },
        // Sort subcategories (nested sort requires a slightly more complex pipeline, but mapping after is easier for few documents)
      ]);

      // Manual sort for subcategories in memory (only 11 arrays of ~8 items max)
      tree.forEach(cat => {
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
