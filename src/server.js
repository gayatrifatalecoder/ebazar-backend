const app = require('./app');
const config = require('./config');
const { connect } = require('./config/database');
const { queues } = require('./config/redis');
const logger = require('./utils/logger');
const { initCronJobs } = require('./jobs/cron');

// Import workers so Bull processors are registered
require('./workers/index');

const startServer = async () => {
  try {
    // 1. Connect to DB
    await connect();

    // 2. Init Cron schedules
    initCronJobs();

    // 3. Start HTTP Server
    const server = app.listen(config.port, () => {
      logger.info(`🚀 E-Bazar backend running on port ${config.port} [${config.nodeEnv}]`);
    });

    // 4. Graceful Shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        try {
          await Promise.all(Object.values(queues).map(q => q.close()));
          const { mongoose } = require('./config/database');
          await mongoose.connection.close();
          logger.info('Shutdown complete');
          process.exit(0);
        } catch (err) {
          logger.error(`Shutdown error: ${err.message}`);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    process.on('unhandledRejection', (reason) => {
      logger.error(`Unhandled rejection: ${reason}`);
    });
    
    process.on('uncaughtException', (err) => {
      logger.error(`Uncaught exception: ${err.message}`);
      shutdown('uncaughtException');
    });

  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
};

startServer();
