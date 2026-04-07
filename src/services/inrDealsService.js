const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const inrDealsClient = axios.create({
  baseURL: config.inrDeals.baseUrl, // e.g. https://api.linkinr.com
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'x-auth-token': config.inrDeals.authKey, // e.g. 49d3210d5fa7d82c3223112650682b96
  },
});

// Retry logic for transient errors
inrDealsClient.interceptors.response.use(
  res => res,
  async (err) => {
    const { config: cfg, response } = err;
    if (!cfg._retryCount) cfg._retryCount = 0;
    if (cfg._retryCount >= 3 || (response && response.status < 500)) {
      return Promise.reject(err);
    }
    cfg._retryCount++;
    await new Promise(res => setTimeout(res, 1000 * cfg._retryCount));
    return inrDealsClient(cfg);
  }
);

const INRDealsService = {
  /**
   * Get all active campaigns (platform list)
   */
  async getCampaigns(params = {}) {
    try {
      let hasNextPage = true;
      let nextCursor = null;
      let allCampaigns = [];

      logger.info('Starting full paginated fetch for INRDeals campaigns...');

      while (hasNextPage) {
        logger.info(`Fetching page with cursor: ${nextCursor || 'null'}...`);

        const requestBody = {
          inventory_id: config.inrDeals.inventoryId,
          store_id: '',
          types: [],
          categories: [],
          regions: ['AE', 'IN'],
          search: '',
          sort_field: 'name',
          sort_order: 'asc',
          status: 'active',
          page_size: 50,
          page_action: 'next',
          cursor: nextCursor,
          ...params
        };

        const { data } = await inrDealsClient.post('/campaigns/list', requestBody);

        if (!data || data.success === false) {
          logger.error(`API Error or No Data found: ${JSON.stringify(data)}`);
          break;
        }

        if (data.data) {
          allCampaigns.push(...data.data);
        }

        hasNextPage = data.meta?.pagination?.has_next_page || false;
        nextCursor = data.meta?.pagination?.next_cursor || null;

        if (hasNextPage) {
          // Delay to prevent hitting rate limits during pagination
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      logger.info(`Finished fetching. Total campaigns retrieved: ${allCampaigns.length}`);
      return { success: true, data: allCampaigns };
    } catch (err) {
      logger.error(`INRDeals getCampaigns error: ${err.message}`);
      throw err;
    }
  },

  /**
   * Get full campaign detail by INRDeals campaign ID
   * Uses POST with inventory_id as requested
   */
  async getCampaignById(campaignId) {
    try {
      const { data } = await inrDealsClient.post(`/campaigns/${campaignId}`, {
        inventory_id: config.inrDeals.inventoryId // e.g. 'gyursI'
      });
      return data.data; // unwrap the "data" envelope
    } catch (err) {
      logger.error(`INRDeals getCampaignById(${campaignId}) error: ${err.message}`);
      throw err;
    }
  },

  /**
   * Map INRDeals campaign detail → our Platform document shape using the new schema
   */
  mapCampaignToPlatform(campaign) {
    return {
      inrDealsId: campaign.id,
      name: campaign.name,
      slug: (campaign.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: campaign.description,
      conversionRate: campaign.conversion_rate,
      access: campaign.access,
      logoUrl: campaign.logo_url,
      status: campaign.status,
      multistep: campaign.multistep,
      defaultUrl: campaign.default_url,
      cookieDuration: campaign.cookie_duration,
      clickAttribution: campaign.click_attribution,
      regions: campaign.regions || [],
      type: campaign.type || {},
      store: {
        url: campaign.store?.url,
        name: campaign.store?.name,
        logo_url: campaign.store?.logo_url,
        playstore: campaign.store?.playstore,
        applestore: campaign.store?.applestore,
      },
      categories: campaign.categories || [],
      subcategories: campaign.subcategories || [],
      tier: campaign.tier || { slabs: [], terms: {}, config: {} },
      inventoryIdUsed: config.inrDeals.inventoryId,
      lastSyncedAt: new Date(),
      syncStatus: 'synced',
    };
  },
};

module.exports = INRDealsService;
