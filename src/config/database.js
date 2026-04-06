const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger'); // We will ensure this exists next

const connect = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    logger.info(`MongoDB Connected: ${mongoose.connection.host}`);
  } catch (err) {
    logger.error(`MongoDB Connection Error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = { connect, mongoose };
