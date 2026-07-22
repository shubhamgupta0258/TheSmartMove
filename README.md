# The Smart Move

Trading education platform for The Smart Move — a premium trading education institute and community based in Bhilai, Chhattisgarh. Built with Node.js/Express, EJS templating, and a Turso (libSQL) database.

Includes a public marketing site, a student portal (Google OAuth + email/password login, manual UPI/QR enrollment), and an admin panel for managing leads, programs, blog posts, enrollments, admins, and live class sessions.

## Deployment

This project will be deployed live at **[thesmartmove.in](https://thesmartmove.in)**, hosted on **Render**, with the domain registered and pointed via **Hostinger**.

The `main` branch is the deployment branch — changes land on `develop` first and are merged into `main` when ready to go live.

Before deploying, the following environment variables must be set in Render's dashboard (see `.env` locally for reference):

- `NODE_ENV=production`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_STUDENT_REDIRECT_URI` (redirect URIs updated to the live domain)
- `UPI_ID`
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`

## Local development

```
npm install
npm run dev
```

Runs on `http://localhost:3000` by default, using a local SQLite file (`data/smartmove.db`) unless `TURSO_DATABASE_URL` is set.
