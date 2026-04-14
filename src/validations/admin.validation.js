const Joi = require('joi');

const updatePlatformSchema = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required()
  }),
  body: Joi.object({
    displayOrder: Joi.number().optional(),
    isActive: Joi.boolean().optional(),
    isFeatured: Joi.boolean().optional(),
    logoUrl: Joi.string().uri().optional(),
    goldRewardRules: Joi.array().items(
      Joi.object({
        region: Joi.string().valid('IN', 'AE').required(),
        slabLabel: Joi.string().required(),
        systemCategoryId: Joi.string().hex().length(24).allow(null).optional(),
        rewardType: Joi.string().valid('percentage_of_commission', 'fixed_amount', 'fixed_grams').required(),
        rewardValue: Joi.number().required(),
        currency: Joi.string().valid('INR', 'AED', 'GRAMS').optional(),
        isActive: Joi.boolean().optional()
      })
    ).optional(),
    goldConfig: Joi.object({
      defaultGoldPercent: Joi.number().min(0).max(100).optional(),
      isGoldEnabled: Joi.boolean().optional()
    }).optional(),
    systemCategoryMappings: Joi.array().items(
      Joi.object({
        slabLabel: Joi.string().required(),
        systemCategory: Joi.string().required(),
        systemSubcategory: Joi.string().optional(),
        isActive: Joi.boolean().optional()
      })
    ).optional()
  })
};

const reorderPlatformsSchema = {
  body: Joi.object({
    order: Joi.array().items(
      Joi.object({
        platformId: Joi.string().hex().length(24).required(),
        displayOrder: Joi.number().required()
      })
    ).required()
  })
};

const syncPlatformSchema = {
  params: Joi.object({
    inrDealsId: Joi.string().required()
  })
};

const triggerScrapeSchema = {
  params: Joi.object({
    platformId: Joi.string().hex().length(24).required()
  })
};

const getScraperJobsSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  })
};

const updateGoldRulesSchema = {
  body: Joi.object({
    defaultGoldPercent: Joi.number().min(0).max(100).optional(),
    goldRules: Joi.array().items(
      Joi.object({
        platformId: Joi.string().hex().length(24).optional(),
        commissionSlabLabel: Joi.string().optional(),
        goldPercent: Joi.number().required(),
        isActive: Joi.boolean().optional()
      })
    ).optional(),
    categoryMappings: Joi.array().optional(),
    flags: Joi.object({
      scrapingEnabled: Joi.boolean(),
      goldEnabled: Joi.boolean()
    }).optional()
  })
};

const updateProductSchema = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required()
  }),
  body: Joi.object({
    isTrending: Joi.boolean().optional(),
    isFeatured: Joi.boolean().optional(),
    isActive: Joi.boolean().optional(),
    displayBoost: Joi.number().optional(),
    category: Joi.string().optional(),
    commissionSlabLabel: Joi.string().optional(),
    commissionPercent: Joi.number().optional()
  })
};

module.exports = {
  updatePlatformSchema,
  reorderPlatformsSchema,
  syncPlatformSchema,
  triggerScrapeSchema,
  getScraperJobsSchema,
  updateGoldRulesSchema,
  updateProductSchema
};
