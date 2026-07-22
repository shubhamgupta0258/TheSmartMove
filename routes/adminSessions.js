const express = require('express');
const db = require('../db/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function getSession(id) {
  return db.prepare('SELECT * FROM class_sessions WHERE id = ?').get(id);
}

router.get('/', requireAdmin, async (req, res) => {
  const sessions = await db.prepare(
    `SELECT class_sessions.*, programs.name AS program_name
     FROM class_sessions
     JOIN programs ON programs.id = class_sessions.program_id
     ORDER BY class_sessions.scheduled_at ASC`
  ).all();
  res.render('admin/sessions', { user: req.user, sessions, now: new Date().toISOString() });
});

router.get('/new', requireAdmin, async (req, res) => {
  const programs = await db.prepare('SELECT * FROM programs ORDER BY sort_order ASC').all();
  res.render('admin/sessions-form', { user: req.user, session: null, programs, error: null });
});

router.post('/', requireAdmin, async (req, res) => {
  const { program_id, title, scheduled_at, meet_link } = req.body;

  if (!program_id || !title || !scheduled_at || !meet_link) {
    const programs = await db.prepare('SELECT * FROM programs ORDER BY sort_order ASC').all();
    return res.status(400).render('admin/sessions-form', {
      user: req.user,
      session: req.body,
      programs,
      error: 'All fields are required.',
    });
  }

  await db.prepare(
    `INSERT INTO class_sessions (program_id, title, scheduled_at, meet_link, created_by)
     VALUES (?, ?, ?, ?, ?)`
  ).run(Number(program_id), title.trim(), scheduled_at, meet_link.trim(), req.user.id);

  res.redirect('/admin/sessions');
});

router.get('/:id/edit', requireAdmin, async (req, res) => {
  const session = await getSession(req.params.id);
  if (!session) return res.redirect('/admin/sessions');
  const programs = await db.prepare('SELECT * FROM programs ORDER BY sort_order ASC').all();
  res.render('admin/sessions-form', { user: req.user, session, programs, error: null });
});

router.post('/:id', requireAdmin, async (req, res) => {
  const session = await getSession(req.params.id);
  if (!session) return res.redirect('/admin/sessions');

  const { program_id, title, scheduled_at, meet_link } = req.body;

  if (!program_id || !title || !scheduled_at || !meet_link) {
    const programs = await db.prepare('SELECT * FROM programs ORDER BY sort_order ASC').all();
    return res.status(400).render('admin/sessions-form', {
      user: req.user,
      session: { ...req.body, id: session.id },
      programs,
      error: 'All fields are required.',
    });
  }

  await db.prepare(
    `UPDATE class_sessions SET program_id = ?, title = ?, scheduled_at = ?, meet_link = ?
     WHERE id = ?`
  ).run(Number(program_id), title.trim(), scheduled_at, meet_link.trim(), session.id);

  res.redirect('/admin/sessions');
});

router.post('/:id/delete', requireAdmin, async (req, res) => {
  await db.prepare('DELETE FROM class_sessions WHERE id = ?').run(req.params.id);
  res.redirect('/admin/sessions');
});

module.exports = router;
