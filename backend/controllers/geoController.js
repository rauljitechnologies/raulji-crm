// backend/controllers/geoController.js
// Serves country and state data from a static comprehensive list

const { COUNTRIES, STATES_BY_COUNTRY } = require('../lib/geoData');

exports.getCountries = (req, res) => {
  return res.json({ success: true, data: { countries: COUNTRIES } });
};

exports.getStates = (req, res) => {
  const { code } = req.params; // ISO country code e.g. "IN", "US"
  if (!code) return res.json({ success: true, data: { states: [] } });
  const states = STATES_BY_COUNTRY[code.toUpperCase()] || [];
  return res.json({ success: true, data: { states } });
};
