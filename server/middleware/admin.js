export default (req, res, next) => {
    // Requires verifyToken middleware to run first to set req.userData
    if (!req.userData) {
        return res.status(401).json({ message: "Authentication required" });
    }

    if (req.userData.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admins only." });
    }

    next();
};
