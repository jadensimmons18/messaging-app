import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";


export const loadMessageHistory = async (req, res) => {
    const {conversationId} = req.params;
    try {
        // Find the conversation
        const conversation = await Conversation.findById(conversationId);

        if (!conversation) {
            return res.status(404).json({message: 'Conversation doesnt exist'});
        }

        // Checks if the user making the request is in the conversation
        // .some will call the function inside of it for each element in the array, 
        // automatically passing in the current element as a parameter of the function
        if (!conversation.participants.some((p) => p.toString() === req.userId)) {
            return res.status(403).json({message: 'You are not authorized to make this request'});
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const messages = await Message.find({ conversation: conversationId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('sender', 'username avatarUrl');

        const total = await Message.countDocuments({ conversation: conversationId });
        return res.status(200).json({message: 'Success'});

    } catch (err) {
        console.error(err);
        return res.status(500).json({message: 'Something went wrong'});
    }
    
}