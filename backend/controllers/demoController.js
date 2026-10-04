import crypto from 'crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Contact from '../models/Contact.js';
import { PERSONAS, SCENARIOS } from '../demo/demoData.js';

const DEMO_LIFETIME_MS = 24 * 60 * 60 * 1000; // guest accounts (and their data) are deleted after a day
const MAX_DEMO_USERS = 500;                    // hard ceiling so the free database can't be filled up

const randomSecret = () => crypto.randomBytes(24).toString('hex');

// Lazy cleanup: instead of a scheduled job, whoever creates a new demo also deletes the old ones.
const deleteExpiredDemoData = async () => {
    const cutoff = new Date(Date.now() - DEMO_LIFETIME_MS);
    const expired = await User.find({ isDemo: true, createdAt: { $lt: cutoff } }).select('_id');
    if (expired.length === 0) return;

    const userIds = expired.map((u) => u._id);
    const conversations = await Conversation.find({ participants: { $in: userIds } }).select('_id');
    const conversationIds = conversations.map((c) => c._id);

    await Message.deleteMany({ conversation: { $in: conversationIds } });
    await Conversation.deleteMany({ _id: { $in: conversationIds } });
    await Contact.deleteMany({ $or: [{ requestedBy: { $in: userIds } }, { recipient: { $in: userIds } }] });
    await User.deleteMany({ _id: { $in: userIds } });
};

// The fake people are ordinary users, created the first time anyone needs them and shared by every demo.
// Nobody can log in as them: their password is random and thrown away.
const ensurePersonas = async () => {
    const existing = await User.find({ username: { $in: PERSONAS } }).select('_id username');
    const byName = new Map(existing.map((u) => [u.username, u]));

    for (const username of PERSONAS) {
        if (byName.has(username)) continue;
        try {
            byName.set(username, await User.create({
                username,
                email: `${username}@demo.ember.invalid`,
                password: randomSecret(),
            }));
        } catch (err) {
            if (err.code !== 11000) throw err;
            // two demos started at the same instant and the other one created it first
            byName.set(username, await User.findOne({ username }).select('_id username'));
        }
    }
    return byName;
};

const createGuest = async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
        const suffix = crypto.randomBytes(3).toString('hex');
        try {
            return await User.create({
                username: `guest_${suffix}`,
                email: `guest_${suffix}@demo.ember.invalid`,
                password: randomSecret(),
                isDemo: true,
            });
        } catch (err) {
            if (err.code !== 11000) throw err;
        }
    }
    throw new Error('Could not generate a unique guest name');
};

export const createDemo = async (req, res) => {
    try {
        await deleteExpiredDemoData();

        if ((await User.countDocuments({ isDemo: true })) >= MAX_DEMO_USERS) {
            return res.status(503).json({ message: 'The demo is busy right now. Please try again later.' });
        }

        const personas = await ensurePersonas();
        const guest = await createGuest();

        const now = Date.now();
        const ago = (minutes) => new Date(now - minutes * 60 * 1000);
        const conversationDocs = [];
        const messageDocs = [];
        const contactDocs = [];

        for (const scenario of SCENARIOS) {
            const persona = personas.get(scenario.persona);
            const conversationId = new mongoose.Types.ObjectId();

            const messages = scenario.messages.map((m) => ({
                _id: new mongoose.Types.ObjectId(),
                conversation: conversationId,
                sender: m.from === 'me' ? guest._id : persona._id,
                content: m.text,
                readBy: [],
                createdAt: ago(m.minutesAgo),
                updatedAt: ago(m.minutesAgo),
                __v: 0,
            }));
            const first = messages[0];
            const last = messages[messages.length - 1];

            const pending = scenario.status === 'pending';
            conversationDocs.push({
                _id: conversationId,
                participants: pending ? [persona._id, guest._id] : [guest._id, persona._id],
                isGroup: false,
                lastMessage: last._id,
                createdAt: first.createdAt,
                updatedAt: last.createdAt, // the conversation list sorts by this
                __v: 0,
            });
            contactDocs.push({
                requestedBy: pending ? persona._id : guest._id,
                recipient: pending ? guest._id : persona._id,
                status: scenario.status,
                createdAt: first.createdAt,
                updatedAt: first.createdAt,
                __v: 0,
            });
            messageDocs.push(...messages);
        }

        // Straight into the collections (skipping Mongoose's normal create) because we need to
        // set our own createdAt/updatedAt timestamps, which Mongoose would otherwise overwrite.
        await Conversation.collection.insertMany(conversationDocs);
        await Message.collection.insertMany(messageDocs);
        await Contact.collection.insertMany(contactDocs);

        const token = jwt.sign({ userId: guest._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        return res.status(201).json({
            message: 'Demo account created',
            token,
            user: { id: guest._id, username: guest.username },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Something went wrong' });
    }
};
