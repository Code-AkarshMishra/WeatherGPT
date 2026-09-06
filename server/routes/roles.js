const express = require('express');
const router = express.Router();
const rolesController = require('../controllers/rolesController');
const { generalLimiter } = require('../middleware/rateLimiter');

router.get('/', generalLimiter, rolesController.getRoles);

module.exports = router;
