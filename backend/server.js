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

const app = express();

const PORT = process.env.PORT || 5001

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
 
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/conversation', conversationRoutes);
app.use('/api/message', messageRoutes);

// Connect to MongoDB
try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
    const httpServer = createServer(app);
    const io = new Server(httpServer, {
        cors: {
            origin: '*',
        },
    });
    httpServer.listen(PORT, () => console.log('On port', PORT));
} catch (err){
    console.log(err);
}