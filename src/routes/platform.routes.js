const express = require('express');
const router = express.Router();
const PlatformController = require('../controllers/platform.controller');

/**
 * @swagger
 * tags:
 *   name: Platforms
 *   description: API to manage platforms and store rewards
 */

/**
 * @swagger
 * /platforms:
 *   get:
 *     summary: Get all platforms
 *     tags: [Platforms]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of platforms per page
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *           enum: [IN, AE]
 *         description: User region (IN or AE)
 *       - in: query
 *         name: isFeatured
 *         schema:
 *           type: boolean
 *         description: Filter by featured platforms
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by system category name (e.g., Electronics)
 *     responses:
 *       200:
 *         description: Paginated list of platforms with gold badges
 */
router.get('/', PlatformController.getPlatforms);

/**
 * @swagger
 * /platforms/{slug}:
 *   get:
 *     summary: Get platform by slug
 *     tags: [Platforms]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: The platform slug (e.g., myntra)
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *           enum: [IN, AE]
 *         description: User region (IN or AE)
 *     responses:
 *       200:
 *         description: Detailed information for a single platform
 */
router.get('/:slug', PlatformController.getPlatformBySlug);

module.exports = router;
