const express = require('express');
const router = express.Router();
const locationController = require('../controllers/location.controller');
const validate = require('../middleware/validate.middleware');
const { searchLocationSchema, getLocationByIdSchema, reverseGeocodeSchema } = require('../validators/location.validator');

router.get('/search', validate(searchLocationSchema), locationController.search);
router.get('/reverse', validate(reverseGeocodeSchema), locationController.reverseGeocode);
router.get('/popular', locationController.getPopularLocations);
router.get('/:id', validate(getLocationByIdSchema), locationController.getLocationById);

module.exports = router;
