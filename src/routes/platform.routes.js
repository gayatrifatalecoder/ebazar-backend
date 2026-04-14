const express = require('express');
const router = express.Router();
const PlatformController = require('../controllers/platform.controller');

router.get('/', PlatformController.getPlatforms);
router.get('/:slug', PlatformController.getPlatformBySlug);

module.exports = router;
