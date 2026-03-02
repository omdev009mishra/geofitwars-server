const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access denied. No valid token provided.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Contains userId
        next();
    } catch (ex) {
        if (ex.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired.' });
        }
        return res.status(400).json({ error: 'Invalid token.' });
    }
};
