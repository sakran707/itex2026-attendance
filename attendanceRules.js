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
function setDay(db, memberId, eventDate, attendanceType) {
  const [start, end] = TIME_RANGES[attendanceType];
  db.prepare(
    `INSERT INTO attendances (member_id, event_date, attendance_type, start_time, end_time, updated_at)
     VALUES (@memberId, @eventDate, @attendanceType, @start, @end, @now)
     ON CONFLICT(member_id, event_date) DO UPDATE SET
       attendance_type = excluded.attendance_type,
       start_time = excluded.start_time,
       end_time = excluded.end_time,
       updated_at = excluded.updated_at`,
  ).run({
    memberId,
    eventDate,
    attendanceType,
    start,
    end,
    now: new Date().toISOString(),
  });
}

function setDays(db, memberId, days) {
  const tx = db.transaction((rows) => {
    for (const { event_date, attendance_type } of rows) {
      setDay(db, memberId, event_date, attendance_type);
    }
  });
  tx(days);
}

/** @returns {{[date: string]: string|null}} every fixed date mapped to its chosen type (or null) */
function scheduleFor(db, memberId) {
  const rows = db
    .prepare('SELECT event_date, attendance_type FROM attendances WHERE member_id = ?')
    .all(memberId);
  const byDate = Object.fromEntries(rows.map((r) => [r.event_date, r.attendance_type]));
  const schedule = {};
  for (const date of EVENT_DATES) schedule[date] = byDate[date] ?? null;
  return schedule;
}

function lastUpdated(db, memberId) {
  const row = db
    .prepare('SELECT MAX(updated_at) AS updated_at FROM attendances WHERE member_id = ?')
    .get(memberId);
  return row?.updated_at ?? null;
}

module.exports = { EVENT_DATES, TIME_RANGES, ATTENDANCE_TYPES, isValidDay, setDays, scheduleFor, lastUpdated };
