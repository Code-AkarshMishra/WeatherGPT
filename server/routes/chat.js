const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { optionalAuth, auth } = require('../middleware/auth');
const { chatLimiter } = require('../middleware/rateLimiter');

// POST /api/chat — supports both guest and authenticated users
router.post('/', chatLimiter, optionalAuth, chatController.validate, chatController.chat);

// Conversation history — requires auth
router.get('/conversations', auth, chatController.getConversations);
router.get('/conversations/:id/messages', auth, chatController.getMessages);

module.exports = router;
