import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
    const header = req.headers.authorization;
    if (header === undefined){
        return res.status(401).json({message: "No token provided"});
    }
    const tokenArr = header.split(' ');
    const token = tokenArr[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};

export default authMiddleware;
