const puppeteer = require('puppeteer');
const crypto = require('crypto');
const Product = require('../../models/Product');
const { ScraperJob } = require('../../models/AdminConfig');
const logger = require('../../utils/logger');

/**
 * Category → commission slab mapping for Myntra (from INRDeals response)
 * These are set at the code level as per your architecture decision
 * Admin can override via AdminConfig.categoryMappings
 */
const MYNTRA_CATEGORY_MAP = {
  // URL path segment → our internal category
  'clothing': 'fashion',
  'kurtas': 'fashion',
  'shirts': 'fashion',
  'jeans': 'fashion',
  'dresses': 'fashion',
  'tops': 'fashion',
  'tshirts': 'fashion',
  'shoes': 'footwear',
  'sandals': 'footwear',
  'sneakers': 'footwear',
  'heels': 'footwear',
  'boots': 'footwear',
  'skincare': 'beauty',
  'makeup': 'beauty',
  'haircare': 'beauty',
  'fragrance': 'beauty',
  'jewellery': 'jewellery',
  'watches': 'jewellery',
  'bags': 'accessories',
  'belts': 'accessories',
  'sunglasses': 'accessories',
  'kids': 'kids',
  'boys': 'kids',
  'girls': 'kids',
  'home': 'home',
  'sports': 'sports',
};

// Pages to scrape per run (add/remove categories as needed)
const SCRAPE_TARGETS = [
  { url: 'https://www.myntra.com/clothing', category: 'fashion', pages: 3 },
  { url: 'https://www.myntra.com/shoes', category: 'footwear', pages: 2 },
  { url: 'https://www.myntra.com/skincare', category: 'beauty', pages: 2 },
  { url: 'https://www.myntra.com/bags', category: 'accessories', pages: 1 },
  { url: 'https://www.myntra.com/kids', category: 'kids', pages: 1 },
];

const MyntraScraper = {
  async run(platform, jobId) {
    const job = await ScraperJob.findById(jobId);
    const stats = { scraped: 0, upserted: 0, failed: 0, pages: 0 };

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
        ],
      });

      await ScraperJob.findByIdAndUpdate(jobId, {
        status: 'running',
        startedAt: new Date(),
      });

      for (const target of SCRAPE_TARGETS) {
        try {
          const products = await this.scrapeTarget(browser, target, platform);
          const results = await this.upsertProducts(products, platform);
          stats.scraped += products.length;
          stats.upserted += results.upserted;
          stats.failed += results.failed;
          stats.pages += target.pages;

          await ScraperJob.findByIdAndUpdate(jobId, {
            productsScraped: stats.scraped,
            productsUpserted: stats.upserted,
            pagesProcessed: stats.pages,
          });

          // Polite delay between targets
          await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
        } catch (err) {
          logger.error(`Myntra scrape target ${target.url} failed: ${err.message}`);
          stats.failed++;
          await ScraperJob.findByIdAndUpdate(jobId, {
            $push: { errorLog: `${target.url}: ${err.message}` }
          });
        }
      }

      const duration = Date.now() - job.startedAt;
      await ScraperJob.findByIdAndUpdate(jobId, {
        status: stats.failed > 0 ? 'partial' : 'completed',
        completedAt: new Date(),
        productsScraped: stats.scraped,
        productsUpserted: stats.upserted,
        productsFailed: stats.failed,
        pagesProcessed: stats.pages,
        durationMs: duration,
      });

      logger.info(`Myntra scrape complete: ${JSON.stringify(stats)}`);
      return stats;
    } catch (err) {
      await ScraperJob.findByIdAndUpdate(jobId, {
        status: 'failed',
        completedAt: new Date(),
        $push: { errorLog: err.message },
      });
      throw err;
    } finally {
      if (browser) await browser.close();
    }
  },

  async scrapeTarget(browser, target, platform) {
    const page = await browser.newPage();
    const products = [];

    try {
      // Mimic real browser
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
      );
      await page.setViewport({ width: 1366, height: 768 });

      for (let pageNum = 1; pageNum <= target.pages; pageNum++) {
        const url = pageNum === 1 ? target.url : `${target.url}?p=${pageNum}`;
        logger.debug(`Scraping: ${url}`);

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForSelector('.product-base', { timeout: 10000 })
          .catch(() => logger.warn(`No products found on ${url}`));

        // Scroll to load lazy images
        await this.autoScroll(page);

        const pageProducts = await page.evaluate((platformId, category) => {
          const items = document.querySelectorAll('.product-base');
          return Array.from(items).slice(0, 40).map(el => {
            const anchor = el.closest('a') || el.querySelector('a');
            const priceEl = el.querySelector('.product-discountedPrice');
            const originalEl = el.querySelector('.product-strike');
            const imgEl = el.querySelector('img.img-responsive');
            const brandEl = el.querySelector('.product-brand');
            const nameEl = el.querySelector('.product-product');

            const priceText = priceEl?.textContent?.replace(/[^0-9]/g, '');
            const origText = originalEl?.textContent?.replace(/[^0-9]/g, '');

            return {
              title: [brandEl?.textContent?.trim(), nameEl?.textContent?.trim()]
                .filter(Boolean).join(' - '),
              brand: brandEl?.textContent?.trim(),
              price: priceText ? parseFloat(priceText) : null,
              originalPrice: origText ? parseFloat(origText) : null,
              primaryImageUrl: imgEl?.src || imgEl?.dataset?.src,
              productUrl: anchor?.href,
              category,
            };
          }).filter(p => p.title && p.price && p.productUrl);
        }, platform._id.toString(), target.category);

        products.push(...pageProducts);

        // Page delay
        await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
      }
    } finally {
      await page.close();
    }

    return products;
  },

  async upsertProducts(products, platform) {
    const results = { upserted: 0, failed: 0 };

    // Resolve commission slab for each product's category
    const CampaignSyncService = require('../campaignSyncService');

    for (const p of products) {
      try {
        const fingerprint = crypto
          .createHash('md5')
          .update(`${platform._id}${p.productUrl}`)
          .digest('hex');

        const slab = await CampaignSyncService.resolveCommissionSlab(
          platform, p.category
        );

        await Product.findOneAndUpdate(
          { productFingerprint: fingerprint },
          {
            $set: {
              ...p,
              platformId: platform._id,
              inrDealsId: platform.inrDealsId,
              commissionSlabLabel: slab.label,
              commissionPercent: slab.percentage,
              productFingerprint: fingerprint,
              scrapeSource: 'myntra_scraper_v1',
              scrapedAt: new Date(),
              isActive: true,
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        results.upserted++;
      } catch (err) {
        logger.error(`Product upsert failed: ${err.message}`);
        results.failed++;
      }
    }

    return results;
  },

  async autoScroll(page) {
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let total = 0;
        const step = 300;
        const timer = setInterval(() => {
          window.scrollBy(0, step);
          total += step;
          if (total >= document.body.scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
  },
};

module.exports = MyntraScraper;
