const Product = require('../models/Product');
const Category = require('../models/Category');
const Platform = require('../models/Platform');
const crypto = require('crypto');

const ProductController = {
  /**
   * INGESTION: POST /api/scraper/products
   * Used by the Python scraper to insert/update a product
   */
  async ingestScrapedProduct(req, res) {
    try {
      const {
        platform,        // "myntra"
        product_name,    // "Round Neck T-Shirt"
        url,             // "..."
        image,           // "..."
        original_price,  // ".799"
        discounted_price,// ".463"
        currency,        // "INR"
        rating,          // "4.2|39"
        category,        // "Fashion"
        sub_category     // "Men's Top Wear"
      } = req.body;

      // 1. Clean numbers
      const pOrig = parseFloat(original_price?.replace(/[^0-9.]/g, ''));
      const pDisc = parseFloat(discounted_price?.replace(/[^0-9.]/g, ''));
      
      // 2. Parse ratings
      let parsedRating = 0, parsedReviews = 0;
      if (rating && rating.includes('|')) {
        const [r, c] = rating.split('|');
        parsedRating = parseFloat(r) || 0;
        parsedReviews = parseInt(c.replace(/[^0-9]/g, ''), 10) || 0;
      }

      // 3. Resolve Platform
      const platformDoc = await Platform.findOne({ name: new RegExp(platform, 'i') });
      if (!platformDoc) {
        return res.status(400).json({ success: false, message: `Platform '${platform}' not found in DB.` });
      }

      // 4. Resolve Category / Subcategory
      let resolvedCategoryId;
      let resolvedCategoryPath = [];
      
      // Quick slugify function (e.g. "Men's Top Wear" -> "mens-top-wear")
      const makeSlug = (str) => str?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      // Try to find exact subcategory first (we assume Python sends the parent slug inside the subcategory string based on how we seeded it, 
      // or we just regex match the name)
      if (sub_category) {
        const subCatDoc = await Category.findOne({ 
          level: 2, 
          name: new RegExp(sub_category, 'i') 
        });

        if (subCatDoc) {
          resolvedCategoryId = subCatDoc._id;
          resolvedCategoryPath = subCatDoc.path;
        }
      }

      // Fallback A: If subcategory missed, attach to parent category directly
      if (!resolvedCategoryId && category) {
        const parentCatDoc = await Category.findOne({
          level: 1,
          name: new RegExp(category, 'i')
        });

        if (parentCatDoc) {
          resolvedCategoryId = parentCatDoc._id;
          resolvedCategoryPath = parentCatDoc.path;
        }
      }

      // If STILL no category resolved, fallback to a fail-safe or reject
      if (!resolvedCategoryId) {
        return res.status(400).json({ success: false, message: `Could not resolve category for '${category}' -> '${sub_category}'.` });
      }

      // 5. Generate unique fingerprint to avoid duplicates
      const fingerprintHash = crypto.createHash('md5').update(`${platformDoc._id}_${url}`).digest('hex');

      // 6. Upsert the product
      const productPayload = {
        platformId: platformDoc._id,
        title: product_name,
        productUrl: url,
        primaryImageUrl: image,
        imageUrls: image ? [image] : [],
        originalPrice: pOrig,
        price: pDisc,
        currency: currency || 'INR',
        rating: parsedRating,
        reviewCount: parsedReviews,
        categoryId: resolvedCategoryId,
        categoryPath: resolvedCategoryPath,
        productFingerprint: fingerprintHash,
      };

      const updatedProduct = await Product.findOneAndUpdate(
        { productFingerprint: fingerprintHash }, // Search by fingerprint
        { $set: productPayload },               // Update data
        { new: true, upsert: true }             // Insert if doesn't exist
      );

      return res.json({ success: true, data: updatedProduct });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * PUBLIC: GET /api/products/top
   * Fetch a small list of top products for the home screen.
   */
  async getTopProducts(req, res) {
    try {
      const limit = req.query.limit;
      
      // Top products definition: isActive = true, and sort by either featured, trending, or highest discount
      const topProducts = await Product.find({ isActive: true })
        .sort({ isFeatured: -1, isTrending: -1, discountPercent: -1 })
        .limit(limit)
        .populate('platformId', 'name logoUrl') // Just get the name and logo of platform
        .lean();

      res.json({ success: true, data: topProducts });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * PUBLIC: GET /api/products
   * General paginated fetch with filters for browsing categories
   */
  async getProducts(req, res) {
    try {
      const { page, limit, categoryId, search, sort } = req.query;

      const query = { isActive: true };

      // If viewing a category, search the categoryPath array!
      if (categoryId) {
        query.categoryPath = categoryId;
      }

      if (search) {
        query.$text = { $search: search };
      }

      // Sort logic
      let sortOptions = { _id: -1 };
      if (sort === 'price_asc') sortOptions = { price: 1 };
      if (sort === 'price_desc') sortOptions = { price: -1 };
      if (sort === 'discount') sortOptions = { discountPercent: -1 };

      const options = {
        page,
        limit,
        sort: sortOptions,
        populate: [{ path: 'platformId', select: 'name logoUrl' }]
      };

      const products = await Product.paginate(query, options);
      res.json({ success: true, data: products });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = ProductController;
