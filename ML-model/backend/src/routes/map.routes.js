const express = require('express');
const router = express.Router();
const mapController = require('../controllers/map.controller');
const validate = require('../middleware/validate.middleware');
const { mapAlertsSchema } = require('../validators/alert.validator');

router.get('/alerts', validate(mapAlertsSchema), mapController.getMapAlerts);
router.get('/layers', mapController.getMapLayers);

module.exports = router;
