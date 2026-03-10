const { Server } = require("socket.io");
const pool = require('./config/database');
const jwt = require("jsonwebtoken");

function initSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: "*"
        }
    });

    // Socket authentication middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error("Authentication error: Missing token"));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.id || decoded.userId; // Support both payloads
            next();
        } catch (err) {
            next(new Error("Authentication error: Invalid token"));
        }
    });

    io.on("connection", (socket) => {
        console.log("Player connected:", socket.id, "User ID:", socket.userId);

        let lastUpdateTime = 0;

        socket.on("player_location_update", async (data) => {
            const now = Date.now();

            // Ignore updates faster than 5 seconds (5000 ms)
            if (now - lastUpdateTime < 5000) {
                return;
            }
            lastUpdateTime = now;

            const { lat, lng, speed } = data;

            if (!lat || !lng) return;

            // Reject movement speed > 10 m/s
            if (speed && speed > 10) {
                console.warn(`Speed violation for user ${socket.userId}: ${speed} m/s`);
                return;
            }

            try {
                // update database location
                await pool.query(
                    `UPDATE users
           SET current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
           WHERE id = $3`,
                    [lng, lat, socket.userId]
                );

                // find nearby players (500 meters)
                const nearby = await pool.query(
                    `SELECT id, username,
           ST_Y(current_location::geometry) AS lat,
           ST_X(current_location::geometry) AS lng
           FROM users
           WHERE id != $1
           AND ST_DWithin(
             current_location,
             ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
             500
           )`,
                    [socket.userId, lng, lat]
                );

                socket.emit("nearby_players_update", nearby.rows);
            } catch (err) {
                console.error("Error updating location:", err);
            }
        });

        socket.on("disconnect", () => {
            console.log("Player disconnected:", socket.id);
        });
    });
}

module.exports = initSocket;
