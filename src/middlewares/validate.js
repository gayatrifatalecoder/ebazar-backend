const validate = (schema) => {
  return (req, res, next) => {
    const { value, error } = schema.validate(req.body, { 
      allowUnknown: true, 
      abortEarly: false 
    });

    if (error) {
      const errorDetails = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      return res.status(400).json({ success: false, errors: errorDetails });
    }

    // Coerce types based on Joi schema parsing
    req.body = value;
    next();
  };
};

module.exports = { validate };
