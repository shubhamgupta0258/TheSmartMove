const express = require('express');
const db = require('../db/db');

const router = express.Router();

router.get('/', async (req, res) => {
  const posts = await db.prepare('SELECT * FROM blog_posts ORDER BY published_at DESC').all();
  res.render('blog', { posts, home: false, notFound: false });
});

router.get('/:slug', async (req, res) => {
  const post = await db.prepare('SELECT * FROM blog_posts WHERE slug = ?').get(req.params.slug);
  if (!post) {
    const posts = await db.prepare('SELECT * FROM blog_posts ORDER BY published_at DESC').all();
    return res.status(404).render('blog', { posts, home: false, notFound: true });
  }
  res.render('blog-post', { post, home: false });
});

module.exports = router;
