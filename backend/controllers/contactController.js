import Contact from '../models/Contact.js';
import User from '../models/User.js';



export const addFriend = async (req, res) => {
    try {
        const userId = req.userId;
        const {recipient} = req.body;

        // Check for self request
        if (userId === recipient) {
            console.log("self request err");
            return res.status(400).json({message: "Self request"});
        }

        // Check for duplicate request
        const existing = await Contact.findOne({
            $or: [
                {requestedBy: req.userId, recipient: recipient},
                { requestedBy: recipient, recipient: req.userId },
            ]
        });
        if (existing) {
            return res.status(409).json({message: "Duplicate request"});
        }

        const newContact = await Contact.create({requestedBy: userId, recipient: recipient});
        console.log("Success");
        return res.status(201).json({message: "Contact created", contact: newContact});
        
    } catch (err){
        console.error(err);
        return res.status(500).json({message: "Something went wrong"});
    }
    
}

export const searchUser = async (req, res) => {
    try {
        const {username} = req.query;
        if (!username) {
            return res.status(400).json({message: 'Nothing entered'});
        }
        // Uses regex to include partial matches and options i to make case-insensitive
        // Must match both parameters username and be "Not Equal"($ne) to userId so that you cant search yourself
        const users = await User.find({ 
            username: { $regex: username, $options: 'i' }, 
            _id: { $ne: req.userId } 
        }).select('username avatarUrl')
        
        return res.status(200).json({message: 'Successful search', users});
        
    } catch (err) {
        console.error(err);
        return res.status(500).json({message: 'Something went wrong'});
    }
}

export const listRequests = async (req, res) => {
    try {
        // .populate() goes into the current users document 
        const requests = await Contact.find({
            recipient: req.userId,
            status: 'pending',
        }).populate('requestedBy', 'username avatarUrl');

        return res.status(200).json({ message: 'Successful', requests });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Something went wrong' });
    }
};

export const acceptFriend = async (req,res) => {
    try {
        const {id} = req.params; // Frontend will send over the document Id that the connection was established in
        const contact = await Contact.findById(id); 
        if (!contact) {
            return res.status(404).json({message: 'Document not found'});
        }
        if (contact.recipient.toString() !== req.userId) {
            return res.status(403).json({message: 'Recipient doesnt match user'});
        }
        if (contact.status !== 'pending') {
            return res.status(409).json({message: 'Request either doesnt exist or was already accepted'});
        }

        contact.status = 'accepted';
        await contact.save();

        return res.status(200).json({message: 'Accepted'});
    } catch (err) {
        console.log(err);
        return res.status(500).json({message: 'There was an issue accepting the request'});
    }

}

export const rejectFriend = async (req,res) => {

    try {
        const {id} = req.params;
        const contact = await Contact.findById(id);

        if (!contact) {
            return res.status(404).json({message: 'Document not found'});
        }
        if (contact.recipient.toString() !== req.userId) {
                return res.status(403).json({message: 'Recipient doesnt match user'});
        }
        if (contact.status !== 'pending') {
                return res.status(409).json({message: 'Request either doesnt exist or was already accepted'});
        }

        await contact.deleteOne();

        return res.status(200).json({message: 'rejected successfully'})
    } catch (err) {
        console.log(err);
        return res.status(500).json({message: 'There was an issue rejecting the request'});
    }
}