import Conversation from '../models/Conversation.js';
import Contact from '../models/Contact.js';


export const getOrCreateConversation = async (req, res) => {
    const {participantId} = req.body;
    
    try {
        // Search for existing conversation
        const existingConversation = await Conversation.findOne({
            $or: [
                {participants: [req.userId, participantId]},
                { participants: [participantId, req.userId]},
            ],
            isGroup: false,
        });
        if (existingConversation) {
            return res.status(200).json({message: 'conversation was found', existingConversation});
        }
        // If the conversation doesnt exist send a friend request
        // First check if the contact already exists before sending a friend request
        const existingContact = await Contact.findOne({
            $or: [
                {requestedBy: req.userId, recipient: participantId},
                { requestedBy: participantId, recipient: req.userId },
            ]
        });
        if (!existingContact) {
            await Contact.create({requestedBy: req.userId, recipient: participantId});
        }
        console.log("Success");

        const newConversation = await Conversation.create({ participants: [req.userId, participantId], isGroup: false });
        return res.status(201).json({message: 'Conversation successfully created', newConversation});
    } catch (err) {
        return res.status(500).json({message: 'Something went wrong'});
    }
}