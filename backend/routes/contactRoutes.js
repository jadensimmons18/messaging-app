import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {addFriend, searchUser, acceptFriend, listRequests, rejectFriend} from '../controllers/contactController.js'

const router = express.Router();

router.post('/request', authMiddleware, addFriend);
router.get('/search', authMiddleware, searchUser);
router.get('/requests', authMiddleware, listRequests);
router.patch('/:id/accept', authMiddleware, acceptFriend);
router.delete('/:id/reject', authMiddleware, rejectFriend);

export default router;