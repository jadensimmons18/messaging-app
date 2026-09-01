import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { getOrCreateConversation } from '../controllers/conversationController.js';

const router = express.Router();

router.post('/', authMiddleware, getOrCreateConversation);

export default router;