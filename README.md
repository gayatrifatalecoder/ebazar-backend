# E-Bazar Backend

Sub-app of Oxy platform. Affiliate e-commerce with gold rewards powered by INRDeals.

---

## Architecture decisions

### Why MongoDB?
- Scraped product data is schema-flexible (each platform returns different shapes)
- Commission slabs are nested arrays that vary per platform
- Full-text search on products is built-in via `$text` index
- Paginate library (`mongoose-paginate-v2`) handles all pagination cleanly

### How INRDeals data flows
```
INRDeals API
  └── /campaigns          → list of active campaigns (platforms)
  └── /campaigns/:id      → full detail: store info, commission slabs, terms
                            (this is the response you shared — Myntra example)

Our system:
  CampaignSyncService.syncAllCampaigns()
    → fetches all campaigns
    → calls getCampaignById() for each
    → upserts as Platform documents
    → preserves admin-controlled fields (displayOrder, goldConfig)
```

### Commission slab → gold calculation
INRDeals gives per-category commissions (e.g. Beauty 6.48%, Apparel 2.16%).
Since scraped products have no category from INRDeals, we:
1. Assign our own category slug at scrape time (e.g. `beauty`, `fashion`)
2. Store `categoryMappings` in AdminConfig: `ourCategory → INRDeals slab label`
3. At link-gen time, look up the correct slab → calculate gold

```
Gold = orderValue × commissionPercent/100 × goldPercent/100

Example (Myntra Beauty product, ₹1000 order):
  commission = 1000 × 6.48/100 = ₹64.80
  gold = 64.80 × 15/100 = ₹9.72 gold
```

### Webhook → gold flow
```
INRDeals webhook (POST /api/webhooks/inrdeals)
  → verify HMAC-SHA256 signature
  → respond 200 immediately (INRDeals needs fast response)
  → find AffiliateClick by our ref
  → create Transaction record
  → push to Bull goldCredits queue
    → GoldService.creditGold()
      → POST to Oxy Gold API
      → update Transaction.goldStatus = "credited"
```

---

## Project structure

```
src/
├── config/
│   ├── index.js          — env config loader
│   ├── database.js       — MongoDB connection with retry
│   └── redis.js          — Redis client + Bull queues
│
├── models/
│   ├── Platform.js       — INRDeals campaigns + admin config
│   ├── Product.js        — scraped products, mapped to platforms
│   ├── AffiliateClick.js — click tracking + Transaction model
│   └── AdminConfig.js    — gold rules, category mappings, ScraperJob
│
├── services/
│   ├── inrDealsService.js        — all INRDeals API calls
│   ├── campaignSyncService.js    — sync INRDeals → MongoDB
│   ├── affiliateLinkService.js   — generate trackable links
│   ├── webhookService.js         — process purchase webhooks
│   ├── goldService.js            — call Oxy gold API
│   └── scrapers/
│       └── myntraScraper.js      — Puppeteer scraper for Myntra
│
├── controllers/          — thin request/response layer
├── routes/index.js       — all routes in one file
├── middleware/auth.js    — JWT validation via Oxy auth service
├── workers/index.js      — Bull queue processors
├── jobs/seed.js          — bootstrap AdminConfig
├── utils/logger.js       — Winston structured logging
├── app.js                — Express setup
└── server.js             — entry point + cron jobs
```

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env
cp .env.example .env
# Fill in: INRDEALS_API_KEY, INRDEALS_AFF_ID, INRDEALS_WEBHOOK_SECRET
# Fill in: OXY_AUTH_SERVICE_URL, OXY_SERVICE_KEY, OXY_GOLD_API_URL, OXY_GOLD_SERVICE_KEY

# 3. Start infrastructure
docker-compose up mongo redis -d

# 4. Seed database
npm run seed

# 5. Start server
npm run dev
```

---

## API reference

### Public
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/platforms` | All active platforms (ordered) |
| GET | `/api/platforms/featured` | Featured platforms |
| GET | `/api/platforms/:slug` | Platform detail |
| GET | `/api/products` | Products with filters (`platform`, `category`, `sort`, `page`) |
| GET | `/api/products/trending` | Trending products for home screen |
| GET | `/api/products/categories` | Category list with counts |
| GET | `/api/products/by-platform/:platformId` | Products for one platform |
| GET | `/api/products/:id` | Product detail |

### Authenticated (Oxy JWT required)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/affiliate/link` | Generate affiliate link `{ productId }` |
| GET | `/api/affiliate/clicks` | User click history |
| GET | `/api/gold/balance` | Gold balance |
| GET | `/api/gold/history` | Gold earning history |

### Admin (admin role required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/dashboard` | Stats overview |
| GET | `/api/admin/platforms` | All platforms with product counts |
| PUT | `/api/admin/platforms/reorder` | Bulk reorder `[{ platformId, displayOrder }]` |
| PUT | `/api/admin/platforms/:id` | Update platform (order, active, gold config) |
| POST | `/api/admin/sync/campaigns` | Trigger full INRDeals sync |
| POST | `/api/admin/sync/campaign/:inrDealsId` | Sync single platform |
| POST | `/api/admin/scrape/:platformId` | Trigger manual scrape |
| GET | `/api/admin/scrape/jobs` | Scraper job history |
| GET | `/api/admin/config` | Get AdminConfig |
| PUT | `/api/admin/gold-rules` | Update gold rules + category mappings |
| PUT | `/api/admin/products/:id` | Mark trending/featured, fix category |

### Webhook
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/webhooks/inrdeals` | INRDeals purchase webhook |

---

## Adding a new platform scraper

1. Create `src/services/scrapers/nykaaScraper.js` (copy Myntra as template)
2. Define `CATEGORY_MAP` for Nykaa URL paths
3. Define `SCRAPE_TARGETS` (URLs + category + pages)
4. Register in `src/workers/index.js`:
   ```js
   const SCRAPERS = {
     myntra: MyntraScraper,
     nykaa: NykaaScraper,  // ← add here
   };
   ```
5. The cron job will auto-pick it up on next run

---

## Gold calculation example

**Scenario:** User buys a Myntra Beauty product (₹1,500 order value)

```
Platform:       Myntra (inrDealsId: cXLVcq)
Product cat:    beauty
INRDeals slab:  "Beauty & Personal Care (New)" → 6.48%
Gold rule:      beauty slab → 15% of commission

commission = 1500 × 6.48% = ₹97.20
gold       = 97.20 × 15%  = ₹14.58

Transaction.goldAmount = 14.58
→ queued to Oxy Gold API → credited to user
```

---

## Queue monitoring

Bull Board is available at `http://localhost:3030` (dev only).
Shows all queues: `ebazar:scrape`, `ebazar:gold`, `ebazar:campaign-sync`, `ebazar:link-tracking`
# ebazar-backend
