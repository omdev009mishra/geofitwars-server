require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/geofitwars'
});

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_geofit_wars';

// Import Routes
const authRoutes = require('./routes/auth');

// Mount Routes
app.use('/auth', authRoutes);

// Create HTTP server and initialize Socket.IO
const http = require('http');
const server = http.createServer(app);
const initSocket = require('./socket');
initSocket(server);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`GeofitWars Auth Backend running on port ${PORT}`);
});
