const path = require('path');
const { createClient } = require('@libsql/client');

// In production, set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN) to point at a
// real Turso database — its data lives on Turso's servers, independent of
// this app's own filesystem, so redeploys/restarts here can't touch it.
// With no TURSO_DATABASE_URL set (e.g. local development), this falls back
// to a plain local file, using the exact same SQLite-compatible engine.
const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${path.join(__dirname, '..', 'data', 'smartmove.db')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    password_hash TEXT,
    google_id TEXT UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'student')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    experience TEXT,
    preferred_time TEXT,
    goals TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS programs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    level TEXT NOT NULL,
    description TEXT NOT NULL,
    duration TEXT NOT NULL,
    mode TEXT NOT NULL,
    price INTEGER,
    features TEXT NOT NULL,
    cta_text TEXT NOT NULL,
    is_featured INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    read_time_minutes INTEGER NOT NULL,
    body TEXT NOT NULL,
    cover_image TEXT,
    author TEXT,
    published_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    program_id INTEGER NOT NULL REFERENCES programs(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
    amount INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    confirmed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS class_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER NOT NULL REFERENCES programs(id),
    title TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    meet_link TEXT NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

// Resolves once the schema exists and migrations have run. server.js awaits
// this before accepting requests, so every route can assume the DB is ready.
const ready = (async () => {
  await client.executeMultiple(SCHEMA);

  // Migration: add is_super_admin to users table if it doesn't exist yet
  // (the table already existed before this column was introduced).
  const info = await client.execute('PRAGMA table_info(users)');
  const userColumns = info.rows.map((c) => c.name);
  if (!userColumns.includes('is_super_admin')) {
    await client.execute('ALTER TABLE users ADD COLUMN is_super_admin INTEGER NOT NULL DEFAULT 0');
  }
})();

// Thin shim over the libSQL client that keeps the same
// db.prepare(sql).get/all/run(...args) shape the rest of the app already
// uses — callers just need `await` in front of each call now, since libSQL
// is async where better-sqlite3 was synchronous.
function prepare(sql) {
  return {
    async get(...args) {
      const result = await client.execute({ sql, args });
      return result.rows[0];
    },
    async all(...args) {
      const result = await client.execute({ sql, args });
      return result.rows;
    },
    async run(...args) {
      const result = await client.execute({ sql, args });
      return {
        lastInsertRowid: Number(result.lastInsertRowid),
        changes: result.rowsAffected,
      };
    },
  };
}

module.exports = { ready, prepare };
