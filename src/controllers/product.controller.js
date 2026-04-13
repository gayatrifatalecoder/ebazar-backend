const Product = require('../models/Products');
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
      const { products } = req.body;

      if (!products || !Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid or empty products array.' });
      }

      // 1. Fetch all Platforms and Categories to avoid per-product DB calls
      const allPlatforms = await Platform.find({ isActive: true }).lean();
      const allCategories = await Category.find({ isActive: true }).lean();

      const bulkOps = [];
      const errors = [];

      for (const item of products) {
        try {
          const {
            platform,
            product_name,
            url,
            image,
            original_price,
            discounted_price,
            currency,
            rating,
            category,
            sub_category
          } = item;

          // Clean numbers
          const pOrig = parseFloat(original_price?.replace(/[^0-9.]/g, ''));
          const pDisc = parseFloat(discounted_price?.replace(/[^0-9.]/g, ''));

          // Parse ratings
          let parsedRating = 0, parsedReviews = 0;
          if (rating && String(rating).includes('|')) {
            const [r, c] = String(rating).split('|');
            parsedRating = parseFloat(r) || 0;
            parsedReviews = parseInt(c.replace(/[^0-9]/g, ''), 10) || 0;
          } else if (rating) {
            parsedRating = parseFloat(rating) || 0;
          }

          // Resolve Platform (Case-insensitive)
          const platformDoc = allPlatforms.find(p => p.name.toLowerCase() === platform.toLowerCase());
          if (!platformDoc) {
            errors.push({ url, error: `Platform '${platform}' not found.` });
            continue;
          }

          // Resolve Category / Subcategory
          let resolvedCategoryId;
          let resolvedCategoryPath = [];

          if (sub_category) {
            const subCatDoc = allCategories.find(c => c.level === 2 && c.name.toLowerCase() === sub_category.toLowerCase());
            if (subCatDoc) {
              resolvedCategoryId = subCatDoc._id;
              resolvedCategoryPath = subCatDoc.path;
            }
          }

          if (!resolvedCategoryId && category) {
            const parentCatDoc = allCategories.find(c => c.level === 1 && c.name.toLowerCase() === category.toLowerCase());
            if (parentCatDoc) {
              resolvedCategoryId = parentCatDoc._id;
              resolvedCategoryPath = parentCatDoc.path;
            }
          }

          if (!resolvedCategoryId) {
            errors.push({ url, error: `Could not resolve category for '${category}' -> '${sub_category}'.` });
            continue;
          }

          // Generate unique fingerprint
          const fingerprintHash = crypto.createHash('md5').update(`${platformDoc._id}_${url}`).digest('hex');

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

          bulkOps.push({
            updateOne: {
              filter: { productFingerprint: fingerprintHash },
              update: { $set: productPayload },
              upsert: true
            }
          });
        } catch (itemErr) {
          errors.push({ url: item.url, error: itemErr.message });
        }
      }

      if (bulkOps.length > 0) {
        await Product.bulkWrite(bulkOps);
      }

      return res.json({
        success: true,
        message: `Processed ${products.length} products.`,
        insertedOrUpdated: bulkOps.length,
        errors: errors.length > 0 ? errors : undefined
      });
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
