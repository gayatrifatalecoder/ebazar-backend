const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const logger = require('./utils/logger');
const routes = require('./routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./utils/swagger');

const app = express();

// ─── SWAGGER DOCS ─────────────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// ─── SECURITY ─────────────────────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: config.isProd
    ? ['https://oxy.app', 'https://ebazar.oxy.app', 'https://admin.ebazar.oxy.app']
    : '*',
  credentials: true,
}));

// ─── RATE LIMITING ────────────────────────────────────────────────────────
app.use('/api', rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please slow down' },
}));

// Stricter limit for affiliate link generation (prevent abuse)
app.use('/api/affiliate/link', rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { success: false, message: 'Too many link requests' },
}));

// ─── RAW BODY FOR WEBHOOK SIGNATURE VERIFICATION ─────────────────────────
// Must come BEFORE json() parser — only applied to webhook route
app.use('/api/webhooks/inrdeals', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body.toString('utf8');
  next();
});

// ─── BODY PARSING ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// ─── LOGGING ──────────────────────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
  skip: (req) => req.url === '/health', // don't log health checks
}));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const mongoose = require('mongoose');
  res.json({
    status: 'ok',
    service: 'ebazar-backend',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ─── API ROUTES ───────────────────────────────────────────────────────────
app.use('/api', routes);

// ─── 404 ──────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.stack}`);
  res.status(err.status || 500).json({
    success: false,
    message: config.isProd ? 'Internal server error' : err.message,
  });
});

module.exports = app;
