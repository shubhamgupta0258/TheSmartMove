const express = require('express');
const db = require('../db/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function getProgram(id) {
  return db.prepare('SELECT * FROM programs WHERE id = ?').get(id);
}

router.get('/', requireAdmin, async (req, res) => {
  const programs = await db.prepare('SELECT * FROM programs ORDER BY sort_order ASC').all();
  res.render('admin/programs', { user: req.user, programs });
});

router.get('/new', requireAdmin, (req, res) => {
  res.render('admin/programs-form', { user: req.user, program: null, error: null });
});

router.post('/', requireAdmin, async (req, res) => {
  const { name, level, description, duration, mode, price, features, cta_text, is_featured, sort_order } = req.body;

  if (!name || !level || !description || !duration || !mode || !features || !cta_text) {
    return res.status(400).render('admin/programs-form', {
      user: req.user,
      program: req.body,
      error: 'All fields except price are required.',
    });
  }

  await db.prepare(
    `INSERT INTO programs (name, level, description, duration, mode, price, features, cta_text, is_featured, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    name.trim(),
    level.trim(),
    description.trim(),
    duration.trim(),
    mode.trim(),
    price ? Number(price) : null,
    features.trim(),
    cta_text.trim(),
    is_featured ? 1 : 0,
    sort_order ? Number(sort_order) : 0
  );

  res.redirect('/admin/programs');
});

router.get('/:id/edit', requireAdmin, async (req, res) => {
  const program = await getProgram(req.params.id);
  if (!program) return res.redirect('/admin/programs');
  res.render('admin/programs-form', { user: req.user, program, error: null });
});

router.post('/:id', requireAdmin, async (req, res) => {
  const program = await getProgram(req.params.id);
  if (!program) return res.redirect('/admin/programs');

  const { name, level, description, duration, mode, price, features, cta_text, is_featured, sort_order } = req.body;

  if (!name || !level || !description || !duration || !mode || !features || !cta_text) {
    return res.status(400).render('admin/programs-form', {
      user: req.user,
      program: { ...req.body, id: program.id },
      error: 'All fields except price are required.',
    });
  }

  await db.prepare(
    `UPDATE programs SET name = ?, level = ?, description = ?, duration = ?, mode = ?, price = ?, features = ?, cta_text = ?, is_featured = ?, sort_order = ?
     WHERE id = ?`
  ).run(
    name.trim(),
    level.trim(),
    description.trim(),
    duration.trim(),
    mode.trim(),
    price ? Number(price) : null,
    features.trim(),
    cta_text.trim(),
    is_featured ? 1 : 0,
    sort_order ? Number(sort_order) : 0,
    program.id
  );

  res.redirect('/admin/programs');
});

router.post('/:id/delete', requireAdmin, async (req, res) => {
  await db.prepare('DELETE FROM programs WHERE id = ?').run(req.params.id);
  res.redirect('/admin/programs');
});

module.exports = router;
