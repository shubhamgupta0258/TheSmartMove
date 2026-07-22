const express = require('express');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const db = require('../db/db');

const router = express.Router();

const WHATSAPP_NUMBER = '919243486441';

function getStudentFromCookie(req) {
  const token = req.cookies.smartmove_token;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.role === 'student' ? payload : null;
  } catch (err) {
    return null;
  }
}

router.get('/:programId', async (req, res) => {
  const program = await db.prepare('SELECT * FROM programs WHERE id = ?').get(req.params.programId);
  if (!program) return res.redirect('/#programs');

  const student = getStudentFromCookie(req);
  if (!student) {
    const redirectTo = `/enroll/${program.id}`;
    return res.redirect(`/student/login?redirect=${encodeURIComponent(redirectTo)}`);
  }

  if (!program.price) {
    return res.render('enroll-pending-price', { program, home: false });
  }

  let enrollment = await db.prepare(
    `SELECT * FROM enrollments WHERE user_id = ? AND program_id = ? AND status != 'rejected'
     ORDER BY created_at DESC LIMIT 1`
  ).get(student.id, program.id);

  if (!enrollment) {
    const result = await db.prepare(
      'INSERT INTO enrollments (user_id, program_id, status, amount) VALUES (?, ?, ?, ?)'
    ).run(student.id, program.id, 'pending', program.price);
    enrollment = await db.prepare('SELECT * FROM enrollments WHERE id = ?').get(result.lastInsertRowid);
  }

  if (enrollment.status === 'confirmed') {
    return res.redirect('/student/dashboard');
  }

  const upiId = process.env.UPI_ID || 'smartmove@placeholder';
  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent('The Smart Move')}&am=${enrollment.amount}&cu=INR`;
  const qrDataUrl = await QRCode.toDataURL(upiUrl, { margin: 1, width: 260 });

  const waText = `Hi The Smart Move, I've completed the payment for ${program.name} (₹${enrollment.amount}). My name is ${student.name}. Enrollment ID: ${enrollment.id}.`;
  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waText)}`;

  res.render('enroll-pay', {
    home: false,
    program,
    enrollment,
    student,
    upiId,
    qrDataUrl,
    waLink,
  });
});

module.exports = router;
