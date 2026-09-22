const express = require('express');
const router = express.Router();
const climateController = require('../controllers/climate.controller');
const validate = require('../middleware/validate.middleware');
const { climateLimiter } = require('../middleware/rateLimiter.middleware');
const { climateHistorySchema, climateTrendSchema } = require('../validators/climate.validator');

router.get('/history', climateLimiter, validate(climateHistorySchema), climateController.getHistory);
router.get('/trend', climateLimiter, validate(climateTrendSchema), climateController.getTrend);

module.exports = router;
