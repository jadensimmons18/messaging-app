import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import loadMessageHistory from '../controllers/messageController.js';

const router = express.Router();

router.get('/loadMessageHistory', authMiddleware, loadMessageHistory);