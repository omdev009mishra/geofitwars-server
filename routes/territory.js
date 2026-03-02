const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/authMiddleware');

// GET /territory/territories
// Returns nearby territories within a certain radius using PostGIS spatial queries
router.get('/territories', authMiddleware, async (req, res) => {
    try {
        const { lat, lng, radius } = req.query;

        if (!lat || !lng || !radius) {
            return res.status(400).json({ error: 'Latitude, longitude, and radius parameters are required.' });
        }

        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
        const radiusMeters = parseFloat(radius);

        if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusMeters)) {
            return res.status(400).json({ error: 'Invalid coordinate or radius formatting.' });
        }

        // PostGIS ST_DWithin query:
        // Finds elements whose GEOGRAPHY point is within radiusMeters of our provided coordinate Point.
        // Ensure longitude comes *first* in PostGIS ST_SetSRID(ST_MakePoint(lng, lat))
        const query = `
      SELECT 
        id, 
        owner_id, 
        area, 
        geojson, 
        created_at 
      FROM territories 
      WHERE ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
    `;

        const result = await db.query(query, [longitude, latitude, radiusMeters]);

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Territory Fetch Error:', err);
        res.status(500).json({ error: 'Server error generating territories.' });
    }
});

module.exports = router;
