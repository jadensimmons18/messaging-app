import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/authRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import { registerSocketHandlers } from './sockets/socketHandlers.js';

const app = express();

const PORT = process.env.PORT || 5001;
const FRONTEND_URL = process.env.FRONTEND_URL;

// Behind Render's proxy every request would appear to come from the proxy's IP, which would make
// per-visitor rate limiting treat everyone as one person. Trust one proxy hop to read the real IP.
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(cors({ origin: FRONTEND_URL }));
app.use(helmet());
 
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/conversation', conversationRoutes);
app.use('/api/message', messageRoutes);
app.get('/api/health', (req, res) => {
    res.status(200).json({ ok: true });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: FRONTEND_URL,
    },
});

registerSocketHandlers(io);

try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
    httpServer.listen(PORT, () => console.log('On port', PORT));
} catch (err){
    console.log(err);
}