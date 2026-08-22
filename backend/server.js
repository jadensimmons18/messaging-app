import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import authRoutes from './routes/authRoutes.js'
import contactRoutes from './routes/contactRoutes.js'

const app = express();

const PORT = process.env.PORT || 5001

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/contact', contactRoutes);

// Connect to MongoDB
try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log('On port ', PORT));
} catch (err){
    console.log(err);
}