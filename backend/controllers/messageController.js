import Conversation from "../models/Conversation.js";


export const loadMessageHistory = async (req, res) => {
    const {conversationId} = req.paramms;
    try {
        // Find the conversation
        const conversation = await Conversation.findById(conversationId);
    } catch (err) {
        return res.status(500).json({message: 'Something went wrong'});
    }
    
}