const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const validate = require('../middleware/validate.middleware');
const { optionalAuth } = require('../middleware/auth.middleware');
const { chatLimiter } = require('../middleware/rateLimiter.middleware');
const { chatMessageSchema } = require('../validators/chat.validator');

router.post('/', chatLimiter, optionalAuth, validate(chatMessageSchema), chatController.sendMessage);
router.post('/stream', chatLimiter, optionalAuth, validate(chatMessageSchema), chatController.streamChat);
router.get('/history/:sessionId', optionalAuth, chatController.getSessionHistory);

module.exports = router;
