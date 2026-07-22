const express = require('express');
const db = require('../db/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
  const enrollments = await db.prepare(
    `SELECT enrollments.*, users.name AS student_name, users.email AS student_email, programs.name AS program_name
     FROM enrollments
     JOIN users ON users.id = enrollments.user_id
     JOIN programs ON programs.id = enrollments.program_id
     ORDER BY
       CASE enrollments.status WHEN 'pending' THEN 0 ELSE 1 END,
       enrollments.created_at DESC`
  ).all();
  res.render('admin/enrollments', { user: req.user, enrollments });
});

router.post('/:id/confirm', requireAdmin, async (req, res) => {
  await db.prepare(
    `UPDATE enrollments SET status = 'confirmed', confirmed_at = datetime('now')
     WHERE id = ? AND status = 'pending'`
  ).run(req.params.id);
  res.redirect('/admin/enrollments');
});

router.post('/:id/reject', requireAdmin, async (req, res) => {
  await db.prepare(
    `UPDATE enrollments SET status = 'rejected' WHERE id = ? AND status = 'pending'`
  ).run(req.params.id);
  res.redirect('/admin/enrollments');
});

module.exports = router;
