// Bootstraps the very first admin account (no password — login is Google-only).
// Every admin after this one can be added from the in-app "Manage Admins" page.
// Usage: node scripts/seedAdmin.js "Name" "email@gmail.com"
require('dotenv').config();
const db = require('../db/db');

const [, , name, email] = process.argv;

if (!name || !email) {
  console.error('Usage: node scripts/seedAdmin.js "Name" "email@gmail.com"');
  process.exit(1);
}

(async () => {
  await db.ready;

  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);

  if (existing) {
    await db.prepare('UPDATE users SET name = ?, role = ? WHERE email = ?').run(name, 'admin', email);
    console.log(`Updated existing user to admin: ${email}`);
  } else {
    await db.prepare('INSERT INTO users (name, email, role) VALUES (?, ?, ?)').run(name, email, 'admin');
    console.log(`Created admin account: ${email}`);
  }

  console.log('They can now sign in at /admin/login with "Continue with Google" using this exact email address.');
})();
