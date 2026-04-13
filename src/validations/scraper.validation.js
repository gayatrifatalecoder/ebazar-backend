const Joi = require('joi');

const productIngestionSchema = {
  body: Joi.object({
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
  })
};

const pythonScraperPayloadSchema = {
  body: Joi.object({
    _id: Joi.object({
      $oid: Joi.string().required()
    }).optional(),
    platform: Joi.string().required(),
    product_name: Joi.string().required(),
    url: Joi.string().uri().required(),
    image: Joi.string().uri().allow('', null).optional(),
    original_price: Joi.string().allow('', null).optional(),
    discounted_price: Joi.string().allow('', null).optional(),
    currency: Joi.string().allow(null).optional(),
    discount_percentage: Joi.any().optional(),
    rating: Joi.string().allow('', null).optional(),
    date_time: Joi.string().isoDate().allow('', null).optional(),
    inr_discount: Joi.any().optional(),
    category: Joi.string().allow('', null).optional(),
    sub_category: Joi.string().allow('', null).optional()
  })
};

module.exports = { productIngestionSchema, pythonScraperPayloadSchema };
