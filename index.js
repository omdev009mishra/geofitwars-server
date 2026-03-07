require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const territoryRoutes = require('./routes/territory');
const friendRoutes = require('./routes/friends');
const kingdomRoutes = require('./routes/kingdom');

const setupMovementSocket = require('./socket/movementSocket');

const app = express();
const server = http.createServer(app);

// Configures Socket.io and attach to same HTTP port as Express
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Middlewares
app.use(cors());
app.use(express.json()); // Parses application/json payloads

// API Routes
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/territory', territoryRoutes);
app.use('/friends', friendRoutes);

// Auth middleware for kingdom routes
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required.' });

    // Using the same jwt verify logic as server.js
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_geofit_wars';
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        // The token payload has { userId: user.id } based on login route
        req.user = { id: user.userId };
        next();
    });
};

app.use('/kingdom', authenticateToken, kingdomRoutes);

// General health check route
app.get('/', (req, res) => {
    res.send('Geofit Wars Backend API Running.');
});

// Setup Real-time Game Socket.io
setupMovementSocket(io);

// Boot up server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[Server] Geofit Wars starting on port ${PORT}`);
    console.log(`[Socket] WebSocket server attached successfully.`);
});
