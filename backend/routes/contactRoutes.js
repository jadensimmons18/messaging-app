import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {addFriend} from '../controllers/contactController.js'

const router = express.Router();

router.post('/request', authMiddleware, addFriend);

export default router;