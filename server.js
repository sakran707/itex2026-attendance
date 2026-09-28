require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const db = require('./db');
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

/* ---------------------------------------------------------------------- */
/* Public: one private link per roster member, no login required          */
/* ---------------------------------------------------------------------- */

app.get('/api/attendance/:token', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE access_token = ?').get(req.params.token);
  if (!member) return res.status(404).json({ message: 'not_found' });

  res.json({
    full_name: member.full_name,
    position_title: member.position_title,
    schedule: rules.scheduleFor(db, member.id),
  });
});

app.put('/api/attendance/:token', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE access_token = ?').get(req.params.token);
  if (!member) return res.status(404).json({ message: 'not_found' });

  const days = req.body?.days;
  if (!Array.isArray(days) || days.length === 0 || !days.every(rules.isValidDay)) {
    return res.status(422).json({ message: 'invalid_days' });
  }

  rules.setDays(db, member.id, days);
  res.json({ message: 'saved', schedule: rules.scheduleFor(db, member.id) });
});

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

app.get('/api/admin/members', requireAdmin, (req, res) => {
  const members = db.prepare('SELECT * FROM members ORDER BY sort_order').all();

  const roster = members.map((m) => ({
    id: m.id,
    full_name: m.full_name,
    position_title: m.position_title,
    category: m.category,
    access_token: m.access_token,
    schedule: rules.scheduleFor(db, m.id),
    updated_at: rules.lastUpdated(db, m.id),
  }));

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
});

app.put('/api/admin/members/:id', requireAdmin, (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ message: 'not_found' });

  const days = req.body?.days;
  if (!Array.isArray(days) || days.length === 0 || !days.every(rules.isValidDay)) {
    return res.status(422).json({ message: 'invalid_days' });
  }

  rules.setDays(db, member.id, days);
  res.json({ message: 'saved', schedule: rules.scheduleFor(db, member.id) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ITEX 2026 attendance app listening on port ${PORT}`));

module.exports = app;
