// server/middleware/auth.js
import jwt from 'jsonwebtoken';

export default (req, res, next) => {
    try {
        // Authorization: "Bearer TOKEN"
        const token = req.headers.authorization.split(" ")[1];
        if (!token) {
            throw new Error('Authentication failed!');
        }
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        req.userData = { userId: decodedToken.userId, username: decodedToken.username, role: decodedToken.role };
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Authentication failed!' });
    }
};