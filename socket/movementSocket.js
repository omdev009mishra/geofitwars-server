const jwt = require('jsonwebtoken');
const { calculateDistance } = require('../utils/geoUtils');
const db = require('../config/database');

const MAX_SPEED = 10; // 10 m/s
const MAX_DISTANCE_JUMP = 100; // 100 meters

// In-memory player state
// Structure: { socketId: { userId, lat, lng, timestamp } }
const players = new Map();

module.exports = (io) => {
    // Authentication Middleware for Socket.io
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error: Token missing.'));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.userId;
            next();
        } catch (err) {
            return next(new Error('Authentication error: Invalid or expired token.'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id} (User: ${socket.userId})`);

        // Initialize player state
        players.set(socket.id, {
            userId: socket.userId,
            lat: null,
            lng: null,
            timestamp: Date.now(),
            energy: null,
            runPath: []
        });

        socket.on('gpsUpdate', (data) => {
            // Data expected: { id, lat, lng, t, e, runPath }
            const { lat, lng, t, e, runPath } = data;

            if (!lat || !lng || !t) {
                socket.emit('errorMsg', { message: 'Invalid GPS payload.' });
                return;
            }

            const playerState = players.get(socket.id);

            // If we have a previous position, validate the jump
            if (playerState.lat !== null && playerState.lng !== null) {
                const distance = calculateDistance(playerState.lat, playerState.lng, lat, lng);
                const timeDiffSeconds = (t - playerState.timestamp) / 1000;

                if (timeDiffSeconds > 0) {
                    const speed = distance / timeDiffSeconds;

                    if (speed > MAX_SPEED || distance > MAX_DISTANCE_JUMP) {
                        console.log(`[AntiCheat] Rejected jump for ${socket.userId}. Speed: ${speed.toFixed(2)}m/s, Dist: ${distance.toFixed(2)}m`);
                        socket.emit('antiCheatFlag', { message: 'Suspicious movement detected.' });
                        return; // Drop invalid point
                    }
                }
            }

            // Valid Update; store state in memory
            playerState.lat = lat;
            playerState.lng = lng;
            playerState.timestamp = t;
            playerState.energy = e;
            if (runPath) {
                playerState.runPath = runPath; // Raw coordinates for future Server Authoritative processing
            }
        });

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
            players.delete(socket.id);
        });
    });

    // Tick System: Broadcast updates every 2000 ms to save bandwidth
    setInterval(() => {
        const activePlayers = Array.from(players.values()).filter(p => p.lat !== null && p.lng !== null);

        // Iterating over all sockets (since we need to send spatial filtered data to each connecting client)
        io.sockets.sockets.forEach((socket) => {
            const receiver = players.get(socket.id);

            // If the receiver hasn't reported a location yet, skip
            if (!receiver || receiver.lat === null || receiver.lng === null) return;

            // Find players within 2km of receiver
            const nearbyPlayers = activePlayers.filter(p => {
                // Exclude self
                if (p.userId === receiver.userId) return false;

                const distance = calculateDistance(receiver.lat, receiver.lng, p.lat, p.lng);
                return distance <= 2000;
            });

            if (nearbyPlayers.length > 0) {
                // Map down the payload size before broadcast
                const payload = nearbyPlayers.map(p => ({
                    userId: p.userId,
                    lat: parseFloat(p.lat.toFixed(6)),
                    lng: parseFloat(p.lng.toFixed(6)),
                    e: p.energy
                }));

                socket.emit('playerUpdate', payload);
            }
        });
    }, 2000);
};
