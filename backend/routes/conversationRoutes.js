import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { getOrCreateConversation, listConversations } from '../controllers/conversationController.js';

const router = express.Router();

router.post('/', authMiddleware, getOrCreateConversation);
router.get('/', authMiddleware, listConversations);

export default router;