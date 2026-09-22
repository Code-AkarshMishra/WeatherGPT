const express = require('express');
const router = express.Router();
const riskController = require('../controllers/risk.controller');
const validate = require('../middleware/validate.middleware');
const { riskQuerySchema } = require('../validators/risk.validator');

router.get('/', validate(riskQuerySchema), riskController.getRiskScore);

module.exports = router;
