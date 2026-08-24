import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {addFriend, searchUser} from '../controllers/contactController.js'

const router = express.Router();

router.post('/request', authMiddleware, addFriend);
router.get('/search', authMiddleware, searchUser);

export default router;