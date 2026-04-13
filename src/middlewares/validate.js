const Joi = require('joi');

const validate = (schema) => {
  return (req, res, next) => {
    // Collect the exact schemas assigned (params, query, body)
    const validSchema = {};
    ['params', 'query', 'body'].forEach((key) => {
      if (schema[key]) validSchema[key] = schema[key];
    });

    const joiSchema = Joi.object(validSchema);

    // Pick only the incoming keys defined by the schema
    const objectToValidate = {};
    Object.keys(validSchema).forEach((key) => {
      objectToValidate[key] = req[key];
    });

    const { value, error } = joiSchema.validate(objectToValidate, {
      abortEarly: false,
      allowUnknown: true, // Typically allow passing extra fields un-validated, or stripUnknown: true
      stripUnknown: false
    });

    if (error) {
      const errorDetails = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      return res.status(400).json({ success: false, errors: errorDetails });
    }

    // Coerce parsed types back into express request object
    Object.assign(req, value);
    return next();
  };
};

module.exports = { validate };
