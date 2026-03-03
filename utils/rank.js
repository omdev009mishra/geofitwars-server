/**
 * Calculate player rank based on total area captured.
 *
 * Rules:
 * SOLO_WARRIOR: area < 10000 m²
 * SUB_KING: area >= 10000
 * EMPEROR: area >= 50000
 * CO_EMPEROR: area >= 100000
 *
 * @param {number} area - Total captured area in square meters
 * @returns {string} - Rank string
 */
function calculateRank(area) {
    if (area >= 100000) {
        return 'CO_EMPEROR';
    } else if (area >= 50000) {
        return 'EMPEROR';
    } else if (area >= 10000) {
        return 'SUB_KING';
    } else {
        return 'SOLO_WARRIOR';
    }
}

module.exports = {
    calculateRank
};
