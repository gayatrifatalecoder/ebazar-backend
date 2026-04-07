const axios = require('axios');
const { cache } = require('../config/redis');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Validates JWT issued by the Oxy auth service
 * Caches valid tokens in Redis for 5 minutes to avoid repeated auth calls
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  const cacheKey = `ebazar:auth:${token.slice(-16)}`; // cache by token suffix

  try {
    // Try cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      req.user = cached;
      return next();
    }

    // Validate with Oxy auth service
    const { data } = await axios.get(`${config.oxy.authServiceUrl}/verify`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-service-key': config.oxy.serviceKey,
      },
      timeout: 5000,
    });

    if (!data.valid || !data.user) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    req.user = data.user; // { id, email, phone, ... }
    await cache.set(cacheKey, data.user, 300); // cache 5 min
    next();
  } catch (err) {
    if (err.response?.status === 401) {
      return res.status(401).json({ success: false, message: 'Token expired or invalid' });
    }
    logger.error(`Auth service error: ${err.message}`);
    return res.status(503).json({ success: false, message: 'Auth service unavailable' });
  }
};

/**
 * Admin-only middleware — checks user role from Oxy auth
 * Attach after authenticate
 */
const requireAdmin = (req, res, next) => {
  if (!req.user?.roles?.includes('admin') && !req.user?.roles?.includes('ebazar_admin')) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

/**
 * Optional auth — attach user if token present but don't block if not
 */
const optionalAuth = async (req, res, next) => {
  if (!req.headers.authorization) return next();
  return authenticate(req, res, next);
};

/**
 * Validates the statically provisioned API key for the scraper webhook
 */
const verifyScraperKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== config.scraper.apiKey) {
    return res.status(401).json({ success: false, message: 'Invalid or missing API key' });
  }
  next();
};

module.exports = { authenticate, requireAdmin, optionalAuth, verifyScraperKey };
