import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';


export const signup = async (req, res) => {
    try {
        const {username, email, password} = req.body;
        const newUser = await User.create({username, email, password});
        const token = jwt.sign({userId: newUser._id}, process.env.JWT_SECRET, {expiresIn: '7d'});

        res.status(201).json({message: "Created", token, user: {id: newUser._id, username: newUser.username}});
    } catch (err) {
        if (err.code === 11000){
            res.status(409).json({message: "Duplicate"});
        }
        else if (err.name === "ValidationError") {
            res.status(400).json({message: err.message});
        }
        else {
            res.status(500).json({message: "Something went wrong"});
            console.error(err);
        }
    }
    return;
}

export const login = async (req,res) => {
    try {
        const {email, password} = req.body;
        const user = await User.findOne({email}).select('+password');
        if (user === null){
            return res.status(401).json({message: "Whoops something went wrong :("});
        }
        const isMatch = await bcrypt.compare(password, user.password);

        if (isMatch){
            const token = jwt.sign({userId: user._id}, process.env.JWT_SECRET, {expiresIn: '7d'});
            res.status(200).json({message: "Successfully logged in", token, user: {id: user._id, username: user.username}});
        } else {
            res.status(401).json({message: "Whoops something went wrong :("});
        }
    } catch (err) {
        res.status(500).json({message: "Whoops something went wrong :("});
        console.log(err);
    }
    return;
}