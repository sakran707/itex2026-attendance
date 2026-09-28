const crypto = require('crypto');
const store = require('./store');
const { emptySchedule } = require('./rules');

const ROSTER_KEY = 'itex2026:roster';

// The fixed roster of 23 people supplied for ITEX 2026 — exactly as given,
// nothing added or renamed. Category groups mirror the request's classification.
const SEED = [
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

function buildSeed() {
  return SEED.map(([full_name, position_title, category, sort_order]) => ({
    id: sort_order,
    full_name,
    position_title,
    category,
    sort_order,
    access_token: crypto.randomBytes(20).toString('hex'),
    schedule: emptySchedule(),
    updated_at: null,
  }));
}

/** Loads the roster, seeding it once (with fresh random tokens) if it doesn't exist yet. */
async function loadRoster() {
  let roster = await store.get(ROSTER_KEY);
  if (!roster || !Array.isArray(roster) || roster.length === 0) {
    roster = buildSeed();
    await store.set(ROSTER_KEY, roster);
  }
  return roster;
}

async function saveRoster(roster) {
  await store.set(ROSTER_KEY, roster);
}

module.exports = { loadRoster, saveRoster };
