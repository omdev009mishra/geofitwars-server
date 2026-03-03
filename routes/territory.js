const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /territory/territories
// Returns nearby territories (public, no login required)
router.get('/territories', async (req, res) => {
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

const { calculateRank } = require('../utils/rank');

// POST /territory/capture
// Captures a territory (public, pass userId in body)
router.post('/capture', async (req, res) => {
  try {
    const userId = req.body.userId;
    const { area, geojson, lat, lng } = req.body;

    if (!area || !geojson || !lat || !lng) {
      return res.status(400).json({ error: 'Incomplete territory data' });
    }

    // Insert new territory into DB
    const territoryQuery = `
            INSERT INTO territories (owner_id, area, geojson, location)
            VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography)
            RETURNING *;
        `;
    const territoryResult = await db.query(territoryQuery, [userId, area, JSON.stringify(geojson), lng, lat]);

    // Update User stats
    const userUpdateQuery = `
            UPDATE users 
            SET total_area = total_area + $1, territories_count = territories_count + 1
            WHERE id = $2
            RETURNING total_area;
        `;
    const userResult = await db.query(userUpdateQuery, [area, userId]);
    const newTotalArea = userResult.rows[0].total_area;

    // Recalculate Rank
    const newRank = calculateRank(newTotalArea);
    await db.query(`UPDATE users SET rank = $1 WHERE id = $2`, [newRank, userId]);

    res.status(200).json({
      success: true,
      territory: territoryResult.rows[0],
      newTotalArea,
      newRank
    });
  } catch (err) {
    console.error('Territory Capture Error:', err);
    res.status(500).json({ error: 'Server error capturing territory.' });
  }
});

module.exports = router;
