const crypto = require('crypto');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

// The fixed roster of 23 people supplied for ITEX 2026 — exactly as given,
// nothing added or renamed. Category groups mirror the request's classification.
const ROSTER = [
  ['أثير حامد عبد الأمير مجيد', 'نقيب المبرمجين العراقيين', 'leadership', 1],
  ['مازن سمير علي محسن الحكيم', 'نائب نقيب نقابة المبرمجين العراقيين', 'leadership', 2],
  ['محمد فاضل مهدي عباس', null, 'council', 3],
  ['ظافر حميد عبد جاسم', null, 'council', 4],
  ['هديل محسن إبراهيم', null, 'council', 5],
  ['ايهم عقيل محمد رضا', null, 'council', 6],
  ['حيدر مجيد ناجي', null, 'council', 7],
  ['ايهاب عنان مهيدي سعيد', null, 'council', 8],
  ['سمير عيسى مانع', null, 'council', 9],
  ['وسام علي حسين سلمان', null, 'council', 10],
  ['وائل وحيد شاتي محمد', null, 'council', 11],
  ['علي صالح يوسف عبد الحسين', null, 'council', 12],
  ['مهند فاضل محمد علي', null, 'council', 13],
  ['بشار مكي نعمة صالح', null, 'council', 14],
  ['ضياء محمد خلف', null, 'council', 15],
  ['آزاد محسن إبراهيم مبارك', null, 'council', 16],
  ['مهند تحرير يونس حسين', null, 'council', 17],
  ['عماد محمد عبود لازم', 'رئيس لجنة صندوق النقابة', 'fund_committee', 18],
  ['منار حسين علي', 'عضو لجنة صندوق النقابة', 'fund_committee', 19],
  ['روزا وليد علي محمد', 'عضو لجنة صندوق النقابة', 'fund_committee', 20],
  ['طيف طه ياسين', 'أمين سر النقابة', 'other', 21],
  ['مصطفى محمد جاسم', 'نائب رئيس لجنة الانضباط', 'other', 22],
  ['عمار عبد ربه سكران', 'رئيس لجنة الانضباط', 'other', 23],
];

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS members (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      position_title TEXT,
      category TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      access_token TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS attendances (
      id SERIAL PRIMARY KEY,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      event_date DATE NOT NULL,
      attendance_type TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      updated_at TIMESTAMPTZ NOT NULL,
      UNIQUE(member_id, event_date)
    );
  `);

  for (const [full_name, position_title, category, sort_order] of ROSTER) {
    const { rows } = await pool.query('SELECT 1 FROM members WHERE full_name = $1', [full_name]);
    if (rows.length) continue;
    await pool.query(
      'INSERT INTO members (full_name, position_title, category, sort_order, access_token) VALUES ($1, $2, $3, $4, $5)',
      [full_name, position_title, category, sort_order, crypto.randomBytes(20).toString('hex')],
    );
  }
}

module.exports = { pool, init };
