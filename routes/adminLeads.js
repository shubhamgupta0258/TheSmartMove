const express = require('express');
const db = require('../db/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
  const leads = await db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
  res.render('admin/leads', { user: req.user, leads });
});

module.exports = router;
