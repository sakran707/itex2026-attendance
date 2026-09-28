require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const { pool, init } = require('./db');
const rules = require('./attendanceRules');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  cookieSession({
    name: 'itex_admin',
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
    maxAge: 12 * 60 * 60 * 1000, // 12h
    httpOnly: true,
    sameSite: 'lax',
  }),
);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me';

function requireAdmin(req, res, next) {
  if (req.session?.isAdmin) return next();
  return res.status(401).json({ message: 'unauthorized' });
}

// Wrap async route handlers so a rejected promise reaches Express's error handler
// instead of crashing the process.
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

/* ---------------------------------------------------------------------- */
/* Public: one private link per roster member, no login required          */
/* ---------------------------------------------------------------------- */

app.get(
  '/api/attendance/:token',
  wrap(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM members WHERE access_token = $1', [req.params.token]);
    const member = rows[0];
    if (!member) return res.status(404).json({ message: 'not_found' });

    res.json({
      full_name: member.full_name,
      position_title: member.position_title,
      schedule: await rules.scheduleFor(pool, member.id),
    });
  }),
);

app.put(
  '/api/attendance/:token',
  wrap(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM members WHERE access_token = $1', [req.params.token]);
    const member = rows[0];
    if (!member) return res.status(404).json({ message: 'not_found' });

    const days = req.body?.days;
    if (!Array.isArray(days) || days.length === 0 || !days.every(rules.isValidDay)) {
      return res.status(422).json({ message: 'invalid_days' });
    }

    await rules.setDays(pool, member.id, days);
    res.json({ message: 'saved', schedule: await rules.scheduleFor(pool, member.id) });
  }),
);

/* ---------------------------------------------------------------------- */
/* Admin: single shared password, session cookie — no per-user accounts   */
/* ---------------------------------------------------------------------- */

app.post('/api/admin/login', (req, res) => {
  if (req.body?.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: 'invalid_password' });
  }
  req.session.isAdmin = true;
  res.json({ message: 'ok' });
});

app.post('/api/admin/logout', (req, res) => {
  req.session = null;
  res.json({ message: 'ok' });
});

app.get('/api/admin/session', (req, res) => {
  res.json({ isAdmin: !!req.session?.isAdmin });
});

app.get(
  '/api/admin/members',
  requireAdmin,
  wrap(async (req, res) => {
    const { rows: members } = await pool.query('SELECT * FROM members ORDER BY sort_order');

    const roster = await Promise.all(
      members.map(async (m) => ({
        id: m.id,
        full_name: m.full_name,
        position_title: m.position_title,
        category: m.category,
        access_token: m.access_token,
        schedule: await rules.scheduleFor(pool, m.id),
        updated_at: await rules.lastUpdated(pool, m.id),
      })),
    );

    const summary = {};
    for (const date of rules.EVENT_DATES) {
      const byType = { full_day: [], morning: [], evening: [], unavailable: [] };
      for (const person of roster) {
        const type = person.schedule[date];
        if (type) byType[type].push(person.full_name);
      }
      summary[date] = byType;
    }

    res.json({ members: roster, summary });
  }),
);

app.put(
  '/api/admin/members/:id',
  requireAdmin,
  wrap(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM members WHERE id = $1', [req.params.id]);
    const member = rows[0];
    if (!member) return res.status(404).json({ message: 'not_found' });

    const days = req.body?.days;
    if (!Array.isArray(days) || days.length === 0 || !days.every(rules.isValidDay)) {
      return res.status(422).json({ message: 'invalid_days' });
    }

    await rules.setDays(pool, member.id, days);
    res.json({ message: 'saved', schedule: await rules.scheduleFor(pool, member.id) });
  }),
);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'server_error' });
});

const PORT = process.env.PORT || 3000;

init()
  .then(() => {
    app.listen(PORT, () => console.log(`ITEX 2026 attendance app listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialize database', err);
    process.exit(1);
  });

module.exports = app;
