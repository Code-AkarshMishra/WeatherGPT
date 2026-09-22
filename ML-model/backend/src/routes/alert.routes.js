const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alert.controller');
const validate = require('../middleware/validate.middleware');
const { listAlertsSchema, alertLocationSchema, alertIdSchema } = require('../validators/alert.validator');

router.get('/', validate(listAlertsSchema), alertController.listAlerts);
router.post('/ingest', alertController.triggerIngestion);
router.get('/location/:locationId', validate(alertLocationSchema), alertController.getAlertsByLocation);
router.get('/:alertId', validate(alertIdSchema), alertController.getAlertById);

module.exports = router;
