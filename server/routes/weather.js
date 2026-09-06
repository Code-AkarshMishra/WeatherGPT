/**
 * Additional geocode endpoint for the weather widget manual search.
 * GET /api/weather/geocode?city=<name>
 */
const express = require('express');
const router = express.Router();
const weatherController = require('../controllers/weatherController');
const geocodeController = require('../controllers/geocodeController');
const { generalLimiter } = require('../middleware/rateLimiter');

router.get('/', generalLimiter, weatherController.validate, weatherController.getWeather);
router.get('/geocode', generalLimiter, geocodeController.geocode);
router.get('/disaster-risk', generalLimiter, weatherController.getDisasterRisk);
router.post('/disaster-risk', generalLimiter, weatherController.getDisasterRisk);

module.exports = router;
