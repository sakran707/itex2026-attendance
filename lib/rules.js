// Single source of truth for the fixed exhibition window and attendance
// types, shared by every API route so the rules can never drift apart.

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

function emptySchedule() {
  const schedule = {};
  for (const date of EVENT_DATES) schedule[date] = null;
  return schedule;
}

/** @param {{event_date: string, attendance_type: string}[]} days */
function applyDays(schedule, days) {
  const next = { ...schedule };
  for (const { event_date, attendance_type } of days) {
    next[event_date] = attendance_type;
  }
  return next;
}

module.exports = { EVENT_DATES, TIME_RANGES, ATTENDANCE_TYPES, isValidDay, emptySchedule, applyDays };
