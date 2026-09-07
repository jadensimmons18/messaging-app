import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {loadMessageHistory, sendMessage} from '../controllers/messageController.js';

const router = express.Router();

router.get('/:conversationId', authMiddleware, loadMessageHistory);
router.post('/:conversationId', authMiddleware, sendMessage);

export default router;