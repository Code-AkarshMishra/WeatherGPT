const express = require('express');
const router = express.Router();
const advisoryController = require('../controllers/advisory.controller');
const validate = require('../middleware/validate.middleware');
const { optionalAuth } = require('../middleware/auth.middleware');
const { advisorySchema } = require('../validators/advisory.validator');

router.post('/', optionalAuth, validate(advisorySchema), advisoryController.generateAdvisory);

module.exports = router;
