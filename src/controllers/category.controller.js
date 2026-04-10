const SYSTEM_CATEGORIES = require('../config/categories');

const CategoryController = {
  /**
   * GET /categories
   * Returns a list of all main categories (without subcategories)
   */
  getAllCategories(req, res) {
    try {
      // Map over categories to return just the ID and Name
      const categories = SYSTEM_CATEGORIES.map(category => ({
        id: category.id,
        name: category.name
      }));
      res.json({ success: true, data: categories });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * GET /categories/:id/subcategories
   * Returns subcategories for a specific category id
   */
  getSubcategories(req, res) {
    try {
      const categoryId = parseInt(req.params.id, 10);
      const category = SYSTEM_CATEGORIES.find(c => c.id === categoryId);

      if (!category) {
        return res.status(404).json({ success: false, message: 'Category not found' });
      }

      res.json({ success: true, data: category.subcategories });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = CategoryController;
