const { isValidDay, applyDays } = require('../lib/rules');
const { loadRoster, saveRoster } = require('../lib/roster');

/**
 * Public endpoint: one private link per roster member, no login required.
 *   GET  /api/attendance?token=...        -> { full_name, position_title, schedule }
 *   PUT  /api/attendance?token=...  {days} -> { message, schedule }
 */
module.exports = async function handler(req, res) {
  const token = req.query.token;
  if (!token) return res.status(400).json({ message: 'missing_token' });

  const roster = await loadRoster();
  const member = roster.find((m) => m.access_token === token);
  if (!member) return res.status(404).json({ message: 'not_found' });

  if (req.method === 'GET') {
    return res.status(200).json({
      full_name: member.full_name,
      position_title: member.position_title,
      schedule: member.schedule,
    });
  }

  if (req.method === 'PUT') {
    const days = req.body?.days;
    if (!Array.isArray(days) || days.length === 0 || !days.every(isValidDay)) {
      return res.status(422).json({ message: 'invalid_days' });
    }
    member.schedule = applyDays(member.schedule, days);
    member.updated_at = new Date().toISOString();
    await saveRoster(roster);
    return res.status(200).json({ message: 'saved', schedule: member.schedule });
  }

  return res.status(405).json({ message: 'method_not_allowed' });
};
