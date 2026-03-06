-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable PostGIS geospatial extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT, -- Made nullable for social logins
    provider TEXT DEFAULT 'local', -- 'local', 'google', 'facebook'
    provider_id TEXT, -- ID from OAuth provider 
    player_id TEXT UNIQUE, -- Unique user-facing player ID
    is_online BOOLEAN DEFAULT false,
    energy INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    distance_run DOUBLE PRECISION DEFAULT 0,
    total_area DOUBLE PRECISION DEFAULT 0,
    territories_count INTEGER DEFAULT 0,
    rank TEXT DEFAULT 'SOLO_WARRIOR',
    avatar TEXT DEFAULT 'default',
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP DEFAULT NOW()
);

-- Territories Table
CREATE TABLE IF NOT EXISTS territories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    area DOUBLE PRECISION NOT NULL,
    geojson JSONB NOT NULL,
    location geography(Point, 4326) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Friends Table
CREATE TABLE IF NOT EXISTS friends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(requester_id, recipient_id) -- Prevent duplicate friend requests
);
