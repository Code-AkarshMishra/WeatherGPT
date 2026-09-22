const express = require('express');
const router = express.Router();
const weatherController = require('../controllers/weather.controller');
const validate = require('../middleware/validate.middleware');
const { coordinateQuerySchema, hourlyWeatherSchema, dailyWeatherSchema } = require('../validators/weather.validator');

router.get('/current', validate(coordinateQuerySchema), weatherController.getCurrent);
router.get('/hourly', validate(hourlyWeatherSchema), weatherController.getHourly);
router.get('/daily', validate(dailyWeatherSchema), weatherController.getDaily);
router.get('/forecast', validate(coordinateQuerySchema), weatherController.getUnifiedForecast);

module.exports = router;
