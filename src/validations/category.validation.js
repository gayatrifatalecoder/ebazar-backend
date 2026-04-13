const Joi = require('joi');

const categoryIdParamSchema = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required()
  })
};

module.exports = {
  categoryIdParamSchema
};
