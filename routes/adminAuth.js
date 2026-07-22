const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db/db');
const { requireAdmin, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const oauthClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

function isLoggedInAsAdmin(req) {
  const token = req.cookies.smartmove_token;
  if (!token) return false;
  try {
    return jwt.verify(token, process.env.JWT_SECRET).role === 'admin';
  } catch (err) {
    return false;
  }
}

router.get('/login', (req, res) => {
  if (isLoggedInAsAdmin(req)) return res.redirect('/admin/dashboard');
  res.render('admin/login', { error: null });
});

router.get('/auth/google', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('g_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 5 * 60 * 1000,
  });
  const url = oauthClient.generateAuthUrl({
    scope: ['openid', 'email', 'profile'],
    state,
  });
  res.redirect(url);
});

router.get('/auth/google/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.render('admin/login', { error: 'Google sign-in was cancelled.' });
  }
  if (!state || state !== req.cookies.g_oauth_state) {
    return res.status(400).render('admin/login', { error: 'Sign-in session expired. Please try again.' });
  }
  res.clearCookie('g_oauth_state');

  try {
    const { tokens } = await oauthClient.getToken(code);
    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload.email_verified) {
      return res.status(401).render('admin/login', { error: 'Your Google email is not verified.' });
    }

    const user = await db.prepare('SELECT * FROM users WHERE email = ? AND role = ?').get(payload.email, 'admin');
    if (!user) {
      return res.status(403).render('admin/login', {
        error: `${payload.email} is not registered as an admin. Ask an existing admin to add you.`,
      });
    }

    if (!user.google_id) {
      await db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(payload.sub, user.id);
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.cookie('smartmove_token', token, COOKIE_OPTIONS);
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error('Google OAuth callback failed:', err.message);
    res.status(500).render('admin/login', { error: 'Something went wrong signing in with Google. Please try again.' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('smartmove_token');
  res.redirect('/login');
});

router.get('/dashboard', requireAdmin, (req, res) => {
  res.render('admin/dashboard', { user: req.user });
});

router.get('/admins', requireAdmin, requireSuperAdmin, async (req, res) => {
  const admins = await db
    .prepare('SELECT id, name, email, google_id, is_super_admin, created_at FROM users WHERE role = ? ORDER BY created_at ASC')
    .all('admin');
  res.render('admin/admins', {
    user: req.user,
    admins,
    error: null,
    success: req.query.success ? 'Admin added.' : null,
  });
});

router.post('/admins', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { name, email } = req.body;
  const listAdmins = () =>
    db.prepare('SELECT id, name, email, google_id, is_super_admin, created_at FROM users WHERE role = ? ORDER BY created_at ASC').all('admin');

  const renderError = async (message) =>
    res.status(400).render('admin/admins', { user: req.user, admins: await listAdmins(), error: message, success: null });

  if (!name || !email) return renderError('Name and email are required.');

  const trimmedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return renderError('Enter a valid email address.');
  }

  const existing = await db.prepare('SELECT id, role FROM users WHERE email = ?').get(trimmedEmail);
  if (existing) {
    return renderError(existing.role === 'admin' ? 'That person is already an admin.' : 'That email is already registered as a student.');
  }

  await db.prepare('INSERT INTO users (name, email, role) VALUES (?, ?, ?)').run(name.trim(), trimmedEmail, 'admin');
  res.redirect('/admin/admins?success=1');
});

router.post('/admins/:id/remove', requireAdmin, requireSuperAdmin, async (req, res) => {
  const targetId = Number(req.params.id);
  const listAdmins = () =>
    db.prepare('SELECT id, name, email, google_id, is_super_admin, created_at FROM users WHERE role = ? ORDER BY created_at ASC').all('admin');

  const renderError = async (message) =>
    res.status(400).render('admin/admins', { user: req.user, admins: await listAdmins(), error: message, success: null });

  if (targetId === req.user.id) {
    return renderError('You cannot remove your own admin access.');
  }

  const adminCount = (await db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get()).c;
  if (adminCount <= 1) {
    return renderError('Cannot remove the last remaining admin.');
  }

  await db.prepare("DELETE FROM users WHERE id = ? AND role = 'admin'").run(targetId);
  res.redirect('/admin/admins');
});

module.exports = router;
