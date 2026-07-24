require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const db = require('./db/db');
const adminAuthRoutes = require('./routes/adminAuth');
const leadsRoutes = require('./routes/leads');
const adminLeadsRoutes = require('./routes/adminLeads');
const adminProgramsRoutes = require('./routes/adminPrograms');
const blogRoutes = require('./routes/blog');
const adminBlogRoutes = require('./routes/adminBlog');
const studentAuthRoutes = require('./routes/studentAuth');
const enrollRoutes = require('./routes/enroll');
const adminEnrollmentsRoutes = require('./routes/adminEnrollments');
const adminSessionsRoutes = require('./routes/adminSessions');
const { attachUser } = require('./middleware/auth');

const app = express();

// Render (and most hosting platforms) sit behind a proxy that terminates
// HTTPS and forwards plain HTTP internally — without this, req.protocol
// would report "http" even in production, breaking the OAuth redirect URI
// computed per-request in adminAuth.js/studentAuth.js.
app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(attachUser);

app.get('/', async (req, res) => {
  // `?browse=1` lets an already-logged-in student reach the homepage's
  // program listing on purpose (e.g. to enroll in a second program),
  // bypassing the normal redirect-to-dashboard behavior below.
  if (res.locals.user && res.locals.user.role === 'student' && !req.query.browse) {
    return res.redirect('/student/dashboard');
  }
  const programs = await db.prepare('SELECT * FROM programs ORDER BY sort_order ASC').all();
  const posts = await db.prepare('SELECT * FROM blog_posts ORDER BY published_at DESC LIMIT 3').all();
  res.render('home', { programs, posts });
});

app.get('/login', (req, res) => {
  res.render('login-select', { home: false });
});

app.get('/privacy-policy', (req, res) => {
  res.render('privacy-policy', { home: false });
});

app.get('/terms', (req, res) => {
  res.render('terms', { home: false });
});

app.use('/admin', adminAuthRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/admin/leads', adminLeadsRoutes);
app.use('/admin/programs', adminProgramsRoutes);
app.use('/blog', blogRoutes);
app.use('/admin/blog', adminBlogRoutes);
app.use('/student', studentAuthRoutes);
app.use('/enroll', enrollRoutes);
app.use('/admin/enrollments', adminEnrollmentsRoutes);
app.use('/admin/sessions', adminSessionsRoutes);

const PORT = process.env.PORT || 3000;
db.ready
  .then(() => {
    app.listen(PORT, () => {
      console.log(`The Smart Move running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
