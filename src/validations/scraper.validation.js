const Joi = require('joi');

const productIngestionSchema = Joi.object({
  products: Joi.array().items(
    Joi.object({
      platform: Joi.string().required(),
      brand: Joi.string().allow('', null).optional(),
      name: Joi.string().required(),
      url: Joi.string().uri().required(),
      image: Joi.string().uri().allow('', null).optional(),
      original_price: Joi.number().allow(null).optional(),
      discounted_price: Joi.number().required(),
      discount_percentage: Joi.number().allow(null).optional(),
      inr_discount: Joi.number().allow(null).optional(),
      currency: Joi.string().optional(),
      rating: Joi.number().allow(null).optional(),
      category: Joi.string().allow(null).optional(),
      scraped_at: Joi.date().iso().allow(null).optional()
    })
  ).min(1).max(2000).required()
});

module.exports = { productIngestionSchema };
