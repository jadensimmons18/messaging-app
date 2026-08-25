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

        const newContact = await Contact.create({requestedBy: userId, recipient});
        console.log("Success");
        return res.status(201).json({message: "Contact created"});
        
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