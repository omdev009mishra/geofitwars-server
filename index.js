require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const territoryRoutes = require('./routes/territory');

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
