const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db/db');
const { requireStudent } = require('../middleware/auth');

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// Built per-request from whatever host the visitor actually used — see the
// matching helper in routes/adminAuth.js for why.
function getOAuthClient(req) {
  const redirectUri = `${req.protocol}://${req.get('host')}/student/auth/google/callback`;
  return new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri);
}

function issueSession(res, user) {
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.cookie('smartmove_token', token, COOKIE_OPTIONS);
}

function isLoggedInAsStudent(req) {
  const token = req.cookies.smartmove_token;
  if (!token) return false;
  try {
    return jwt.verify(token, process.env.JWT_SECRET).role === 'student';
  } catch (err) {
    return false;
  }
}

// Only allow redirecting back to a same-site relative path (never an
// absolute/external URL) — prevents this becoming an open redirect.
function safeRedirect(target) {
  if (typeof target !== 'string') return null;
  if (!target.startsWith('/') || target.startsWith('//')) return null;
  return target;
}

// ---------- Email/password signup ----------

router.get('/signup', (req, res) => {
  const redirectTo = safeRedirect(req.query.redirect) || '';
  if (isLoggedInAsStudent(req)) return res.redirect(redirectTo || '/student/dashboard');
  res.render('student/signup', { error: null, values: {}, redirectTo });
});

router.post('/signup', async (req, res) => {
  const { name, email, phone, password, confirm_password, redirect } = req.body;
  const redirectTo = safeRedirect(redirect) || '';

  const renderError = (message) =>
    res.status(400).render('student/signup', { error: message, values: req.body, redirectTo });

  if (!name || !email || !password || !confirm_password) {
    return renderError('Name, email and password are required.');
  }
  const trimmedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return renderError('Enter a valid email address.');
  }
  if (password.length < 8) {
    return renderError('Password must be at least 8 characters.');
  }
  if (password !== confirm_password) {
    return renderError('Password and confirmation do not match.');
  }

  const existing = await db.prepare('SELECT id, role FROM users WHERE email = ?').get(trimmedEmail);
  if (existing) {
    return renderError(
      existing.role === 'admin'
        ? 'This email is registered as an admin.'
        : 'An account with this email already exists — log in instead.'
    );
  }

  const password_hash = bcrypt.hashSync(password, 12);
  const result = await db.prepare(
    'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  ).run(name.trim(), trimmedEmail, (phone || '').trim() || null, password_hash, 'student');

  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  issueSession(res, user);
  res.redirect(redirectTo || '/student/dashboard');
});

// ---------- Email/password login ----------

router.get('/login', (req, res) => {
  const redirectTo = safeRedirect(req.query.redirect) || '';
  if (isLoggedInAsStudent(req)) return res.redirect(redirectTo || '/student/dashboard');
  res.render('student/login', { error: null, redirectTo });
});

router.post('/login', async (req, res) => {
  const { email, password, redirect } = req.body;
  const redirectTo = safeRedirect(redirect) || '';
  const trimmedEmail = (email || '').trim().toLowerCase();

  const user = await db.prepare('SELECT * FROM users WHERE email = ? AND role = ?').get(trimmedEmail, 'student');
  if (!user || !user.password_hash) {
    return res.status(401).render('student/login', {
      error: user ? 'This account uses Google sign-in — use "Continue with Google" below.' : 'Invalid email or password.',
      redirectTo,
    });
  }

  const valid = bcrypt.compareSync(password || '', user.password_hash);
  if (!valid) {
    return res.status(401).render('student/login', { error: 'Invalid email or password.', redirectTo });
  }

  issueSession(res, user);
  res.redirect(redirectTo || '/student/dashboard');
});

// ---------- Google OAuth (signup + login combined — students can self-register) ----------

router.get('/auth/google', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('g_oauth_state_student', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 5 * 60 * 1000,
  });
  const redirectTo = safeRedirect(req.query.redirect);
  if (redirectTo) {
    res.cookie('student_post_login_redirect', redirectTo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000,
    });
  } else {
    res.clearCookie('student_post_login_redirect');
  }
  const url = getOAuthClient(req).generateAuthUrl({
    scope: ['openid', 'email', 'profile'],
    state,
  });
  res.redirect(url);
});

router.get('/auth/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const redirectTo = safeRedirect(req.cookies.student_post_login_redirect) || '';
  res.clearCookie('student_post_login_redirect');

  if (error) {
    return res.render('student/login', { error: 'Google sign-in was cancelled.', redirectTo });
  }
  if (!state || state !== req.cookies.g_oauth_state_student) {
    return res.status(400).render('student/login', { error: 'Sign-in session expired. Please try again.', redirectTo });
  }
  res.clearCookie('g_oauth_state_student');

  try {
    const oauthClient = getOAuthClient(req);
    const { tokens } = await oauthClient.getToken(code);
    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload.email_verified) {
      return res.status(401).render('student/login', { error: 'Your Google email is not verified.', redirectTo });
    }

    let user = await db.prepare('SELECT * FROM users WHERE email = ?').get(payload.email);

    if (user && user.role === 'admin') {
      return res.status(403).render('student/login', {
        error: 'This email is registered as an admin. Use Admin Login instead.',
        redirectTo,
      });
    }

    if (user) {
      if (!user.google_id) {
        await db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(payload.sub, user.id);
      }
    } else {
      const result = await db.prepare(
        'INSERT INTO users (name, email, google_id, role) VALUES (?, ?, ?, ?)'
      ).run(payload.name || payload.email, payload.email, payload.sub, 'student');
      user = await db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    }

    issueSession(res, user);
    res.redirect(redirectTo || '/student/dashboard');
  } catch (err) {
    console.error('Student Google OAuth callback failed:', err.message);
    res.status(500).render('student/login', { error: 'Something went wrong signing in with Google. Please try again.', redirectTo });
  }
});

// ---------- Logout + dashboard ----------

router.post('/logout', (req, res) => {
  res.clearCookie('smartmove_token');
  res.redirect('/login');
});

router.get('/dashboard', requireStudent, async (req, res) => {
  const enrollments = await db.prepare(
    `SELECT enrollments.*, programs.name AS program_name
     FROM enrollments
     JOIN programs ON programs.id = enrollments.program_id
     WHERE enrollments.user_id = ?
     ORDER BY enrollments.created_at DESC`
  ).all(req.user.id);

  const sessions = await db.prepare(
    `SELECT class_sessions.*, programs.name AS program_name
     FROM class_sessions
     JOIN programs ON programs.id = class_sessions.program_id
     JOIN enrollments ON enrollments.program_id = class_sessions.program_id
     WHERE enrollments.user_id = ? AND enrollments.status = 'confirmed'
     ORDER BY class_sessions.scheduled_at ASC`
  ).all(req.user.id);
  const now = new Date();
  const upcomingSessions = sessions.filter((s) => new Date(s.scheduled_at) >= now);

  res.render('student/dashboard', { user: req.user, enrollments, upcomingSessions });
});

module.exports = router;
