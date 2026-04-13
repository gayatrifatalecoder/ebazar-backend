const Joi = require('joi');

const getTopProductsSchema = {
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(50).default(10)
  })
};

const getProductsSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    categoryId: Joi.string().hex().length(24).optional(),
    search: Joi.string().max(100).optional(),
    sort: Joi.string().valid('price_asc', 'price_desc', 'discount').optional()
  })
};

module.exports = {
  getTopProductsSchema,
  getProductsSchema
};
