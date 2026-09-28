import jwt from 'jsonwebtoken';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

export const registerSocketHandlers = (io) => {
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;

        if (!token) {
            return next(new Error('No token provided'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.userId;
            next();
        } catch (err) {
            next(new Error('Invalid or expired token'));
        }
    });

    io.on('connection', (socket) => {
        console.log('a user connected:', socket.id, '| userId:', socket.userId);

        socket.on('join_conversation', async (conversationId) => {
            try {
                const conversation = await Conversation.findById(conversationId);

                if (!conversation) {
                    return socket.emit('error', { message: 'Conversation not found' });
                }

                if (!conversation.participants.some((p) => p.toString() === socket.userId)) {
                    return socket.emit('error', { message: 'You are not authorized to join this conversation' });
                }

                socket.join(conversationId);
                socket.emit('joined_conversation', conversationId);
            } catch (err) {
                console.error(err);
                socket.emit('error', { message: 'Something went wrong' });
            }
        });

        socket.on('send_message', async ({ conversationId, content }) => {
            try {
                const conversation = await Conversation.findById(conversationId);

                if (!conversation) {
                    return socket.emit('error', { message: 'Conversation not found' });
                }

                if (!conversation.participants.some((p) => p.toString() === socket.userId)) {
                    return socket.emit('error', { message: 'You are not authorized to send messages in this conversation' });
                }

                const newMessage = await Message.create({ conversation: conversationId, sender: socket.userId, content });

                conversation.lastMessage = newMessage._id;
                await conversation.save();

                const populatedMessage = await Message.findById(newMessage._id).populate('sender', 'username avatarUrl');

                io.to(conversationId).emit('receive_message', populatedMessage);
            } catch (err) {
                if (err.name === 'ValidationError') {
                    socket.emit('error', { message: err.message });
                } else {
                    console.error(err);
                    socket.emit('error', { message: 'Something went wrong' });
                }
            }
        });
    });
};
