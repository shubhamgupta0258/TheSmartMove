const express = require('express');
const db = require('../db/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function uniqueSlug(title, excludeId) {
  const base = slugify(title) || 'post';
  let slug = base;
  let n = 2;
  while (true) {
    const existing = await db.prepare('SELECT id FROM blog_posts WHERE slug = ?').get(slug);
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${n}`;
    n++;
  }
}

function getPost(id) {
  return db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(id);
}

router.get('/', requireAdmin, async (req, res) => {
  const posts = await db.prepare('SELECT * FROM blog_posts ORDER BY published_at DESC').all();
  res.render('admin/blog', { user: req.user, posts });
});

router.get('/new', requireAdmin, (req, res) => {
  res.render('admin/blog-form', { user: req.user, post: null, error: null });
});

router.post('/', requireAdmin, async (req, res) => {
  const { title, category, read_time_minutes, body, cover_image, author } = req.body;

  if (!title || !category || !read_time_minutes || !body) {
    return res.status(400).render('admin/blog-form', {
      user: req.user,
      post: req.body,
      error: 'Title, category, read time, and body are required.',
    });
  }

  const slug = await uniqueSlug(title);

  await db.prepare(
    `INSERT INTO blog_posts (title, slug, category, read_time_minutes, body, cover_image, author)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    title.trim(),
    slug,
    category.trim(),
    Number(read_time_minutes),
    body.trim(),
    (cover_image || '').trim() || null,
    (author || '').trim() || null
  );

  res.redirect('/admin/blog');
});

router.get('/:id/edit', requireAdmin, async (req, res) => {
  const post = await getPost(req.params.id);
  if (!post) return res.redirect('/admin/blog');
  res.render('admin/blog-form', { user: req.user, post, error: null });
});

router.post('/:id', requireAdmin, async (req, res) => {
  const post = await getPost(req.params.id);
  if (!post) return res.redirect('/admin/blog');

  const { title, category, read_time_minutes, body, cover_image, author } = req.body;

  if (!title || !category || !read_time_minutes || !body) {
    return res.status(400).render('admin/blog-form', {
      user: req.user,
      post: { ...req.body, id: post.id, slug: post.slug },
      error: 'Title, category, read time, and body are required.',
    });
  }

  const slug = title.trim() === post.title ? post.slug : await uniqueSlug(title, post.id);

  await db.prepare(
    `UPDATE blog_posts SET title = ?, slug = ?, category = ?, read_time_minutes = ?, body = ?, cover_image = ?, author = ?
     WHERE id = ?`
  ).run(
    title.trim(),
    slug,
    category.trim(),
    Number(read_time_minutes),
    body.trim(),
    (cover_image || '').trim() || null,
    (author || '').trim() || null,
    post.id
  );

  res.redirect('/admin/blog');
});

router.post('/:id/delete', requireAdmin, async (req, res) => {
  await db.prepare('DELETE FROM blog_posts WHERE id = ?').run(req.params.id);
  res.redirect('/admin/blog');
});

module.exports = router;
