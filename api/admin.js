const { EVENT_DATES, ATTENDANCE_TYPES, isValidDay, applyDays } = require('../lib/rules');
const { loadRoster, saveRoster } = require('../lib/roster');
const { buildCookie, isAdmin } = require('../lib/session');

function buildSummary(roster) {
  const summary = {};
  for (const date of EVENT_DATES) {
    const byType = Object.fromEntries(ATTENDANCE_TYPES.map((t) => [t, []]));
    for (const person of roster) {
      const type = person.schedule[date];
      if (type) byType[type].push(person.full_name);
    }
    summary[date] = byType;
  }
  return summary;
}

/**
 * Single admin endpoint, routed by `?action=`:
 *   POST login    {password}        -> sets/rejects the admin session cookie
 *   POST logout                     -> clears the admin session cookie
 *   GET  session                    -> { isAdmin }
 *   GET  members                    -> { members, summary }        (requires session)
 *   PUT  update   {id, days}        -> { message, schedule }       (requires session)
 */
module.exports = async function handler(req, res) {
  const action = req.query.action;

  if (action === 'login' && req.method === 'POST') {
    if (req.body?.password !== (process.env.ADMIN_PASSWORD || 'change-me')) {
      return res.status(401).json({ message: 'invalid_password' });
    }
    res.setHeader('Set-Cookie', buildCookie(true));
    return res.status(200).json({ message: 'ok' });
  }

  if (action === 'logout' && req.method === 'POST') {
    res.setHeader('Set-Cookie', buildCookie(false));
    return res.status(200).json({ message: 'ok' });
  }

  if (action === 'session' && req.method === 'GET') {
    return res.status(200).json({ isAdmin: isAdmin(req) });
  }

  if (!isAdmin(req)) return res.status(401).json({ message: 'unauthorized' });

  if (action === 'members' && req.method === 'GET') {
    const roster = await loadRoster();
    const members = [...roster].sort((a, b) => a.sort_order - b.sort_order);
    return res.status(200).json({ members, summary: buildSummary(roster) });
  }

  if (action === 'update' && req.method === 'PUT') {
    const roster = await loadRoster();
    const member = roster.find((m) => m.id === Number(req.body?.id));
    if (!member) return res.status(404).json({ message: 'not_found' });

    const days = req.body?.days;
    if (!Array.isArray(days) || days.length === 0 || !days.every(isValidDay)) {
      return res.status(422).json({ message: 'invalid_days' });
    }
    member.schedule = applyDays(member.schedule, days);
    member.updated_at = new Date().toISOString();
    await saveRoster(roster);
    return res.status(200).json({ message: 'saved', schedule: member.schedule });
  }

  return res.status(404).json({ message: 'unknown_action' });
};
