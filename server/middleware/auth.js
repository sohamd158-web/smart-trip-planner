const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'tripsplit_ai_secure_jwt_secret_2026';

module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Session expired — please log in again' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Invalid or expired session — please log in again' });
  }
};
