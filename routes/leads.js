const express = require('express');
const db = require('../db/db');

const router = express.Router();

router.post('/', async (req, res) => {
  const { name, phone, email, exp, time, goals } = req.body;

  if (!name || !name.trim() || !phone || !phone.trim()) {
    return res.status(400).json({ error: 'Name and phone are required.' });
  }

  await db.prepare(
    `INSERT INTO leads (name, phone, email, experience, preferred_time, goals)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(name.trim(), phone.trim(), (email || '').trim(), exp || '', time || '', goals || '');

  res.status(201).json({ ok: true });
});

module.exports = router;
