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
    goldConfig: Joi.object({
      baseCommissionPercent: Joi.number().min(0).max(100).required(),
      goldRules: Joi.array().items(
        Joi.object({
          thresholdAmount: Joi.number().required(),
          goldRewardPercent: Joi.number().required()
        })
      ).optional()
    }).optional(),
    systemCategoryMappings: Joi.array().items(
      Joi.object({
        platformSlabMatches: Joi.array().items(Joi.string()).required(),
        systemCategory: Joi.string().required()
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
        thresholdAmount: Joi.number().required(),
        goldRewardPercent: Joi.number().required()
      })
    ).optional(),
    categoryMappings: Joi.array().optional(),
    flags: Joi.object().optional()
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
