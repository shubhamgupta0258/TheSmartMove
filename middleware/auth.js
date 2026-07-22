const jwt = require('jsonwebtoken');
const db = require('../db/db');

function requireRole(role, loginPath) {
  return async function (req, res, next) {
    // Prevents the browser (and its back/forward cache) from showing this
    // page again after logout — without this, clicking "back" can display
    // the last-rendered authenticated page even though the session cookie
    // is gone, until something forces a real re-request.
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');

    const token = req.cookies.smartmove_token;
    if (!token) return res.redirect(loginPath);

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload.role !== role) return res.redirect(loginPath);

      if (role === 'admin') {
        // Read fresh from the DB rather than trusting the JWT claim, so a
        // promotion/demotion to super admin takes effect immediately
        // instead of waiting up to 7 days for the token to expire.
        const row = await db.prepare('SELECT is_super_admin FROM users WHERE id = ?').get(payload.id);
        payload.is_super_admin = !!(row && row.is_super_admin);
      }

      req.user = payload;
      next();
    } catch (err) {
      return res.redirect(loginPath);
    }
  };
}

const requireAdmin = requireRole('admin', '/admin/login');
const requireStudent = requireRole('student', '/student/login');

// Must run after requireAdmin.
function requireSuperAdmin(req, res, next) {
  if (!req.user || !req.user.is_super_admin) return res.redirect('/admin/dashboard');
  next();
}

// Non-enforcing: makes `user` available to every view (e.g. the public nav)
// so it can tell a logged-in visitor apart from a logged-out one, without
// requiring login or redirecting anywhere.
function attachUser(req, res, next) {
  const token = req.cookies.smartmove_token;
  if (token) {
    try {
      res.locals.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      res.locals.user = null;
    }
  } else {
    res.locals.user = null;
  }
  next();
}

module.exports = { requireAdmin, requireStudent, requireSuperAdmin, attachUser };
