import express from 'express';
import { rateLimit } from 'express-rate-limit';
import {signup, login} from '../controllers/authController.js'
import { createDemo } from '../controllers/demoController.js';

const router = express.Router();

// Each demo click creates a user plus ~20 documents, so cap how often one visitor can do it
const demoLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many demo accounts created from your network. Please try again later.' },
});

// Routes
router.post('/signup',signup);
router.post('/login', login);
router.post('/demo', demoLimiter, createDemo);

export default router;