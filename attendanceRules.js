// Single source of truth for the fixed exhibition window and attendance
// types, shared by every route so the rules can never drift apart.

const EVENT_DATES = ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'];

const TIME_RANGES = {
  full_day: ['10:00', '20:00'],
  morning: ['10:00', '15:00'],
  evening: ['15:00', '20:00'],
  unavailable: [null, null],
};

const ATTENDANCE_TYPES = Object.keys(TIME_RANGES);

function isValidDay(day) {
  return (
    day &&
    typeof day.event_date === 'string' &&
    EVENT_DATES.includes(day.event_date) &&
    typeof day.attendance_type === 'string' &&
    ATTENDANCE_TYPES.includes(day.attendance_type)
  );
}

/** Upsert one day's attendance choice for a member; time range is derived, never taken from the client. */
async function setDay(pool, memberId, eventDate, attendanceType) {
  const [start, end] = TIME_RANGES[attendanceType];
  await pool.query(
    `INSERT INTO attendances (member_id, event_date, attendance_type, start_time, end_time, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (member_id, event_date) DO UPDATE SET
       attendance_type = excluded.attendance_type,
       start_time = excluded.start_time,
       end_time = excluded.end_time,
       updated_at = excluded.updated_at`,
    [memberId, eventDate, attendanceType, start, end],
  );
}

async function setDays(pool, memberId, days) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const { event_date, attendance_type } of days) {
      await setDay(client, memberId, event_date, attendance_type);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** @returns {{[date: string]: string|null}} every fixed date mapped to its chosen type (or null) */
async function scheduleFor(pool, memberId) {
  const { rows } = await pool.query(
    `SELECT to_char(event_date, 'YYYY-MM-DD') AS event_date, attendance_type
     FROM attendances WHERE member_id = $1`,
    [memberId],
  );
  const byDate = Object.fromEntries(rows.map((r) => [r.event_date, r.attendance_type]));
  const schedule = {};
  for (const date of EVENT_DATES) schedule[date] = byDate[date] ?? null;
  return schedule;
}

async function lastUpdated(pool, memberId) {
  const { rows } = await pool.query(
    'SELECT MAX(updated_at) AS updated_at FROM attendances WHERE member_id = $1',
    [memberId],
  );
  return rows[0]?.updated_at ?? null;
}

module.exports = { EVENT_DATES, TIME_RANGES, ATTENDANCE_TYPES, isValidDay, setDays, scheduleFor, lastUpdated };
