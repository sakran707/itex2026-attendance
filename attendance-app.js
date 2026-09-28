const EVENT_DATES = ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'];

const DAY_LABELS = {
  '2026-09-30': { ar: 'الأربعاء 30/9/2026', en: 'Wed 9/30/2026' },
  '2026-10-01': { ar: 'الخميس 1/10/2026', en: 'Thu 10/1/2026' },
  '2026-10-02': { ar: 'الجمعة 2/10/2026', en: 'Fri 10/2/2026' },
  '2026-10-03': { ar: 'السبت 3/10/2026', en: 'Sat 10/3/2026' },
};

const TYPE_OPTIONS = [
  { value: 'full_day', ar: 'يوم كامل', en: 'Full day', hint: '10:00 – 20:00' },
  { value: 'morning', ar: 'الشفت الصباحي', en: 'Morning shift', hint: '10:00 – 15:00' },
  { value: 'evening', ar: 'الشفت المسائي', en: 'Evening shift', hint: '15:00 – 20:00' },
  { value: 'unavailable', ar: 'غير متاح', en: 'Unavailable', hint: '' },
];

let lang = localStorage.getItem('itex_lang') || 'ar';
const isAr = () => lang === 'ar';

function setLang(l) {
  lang = l;
  localStorage.setItem('itex_lang', l);
  document.body.classList.toggle('ltr', l === 'en');
  document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  render();
}

const app = document.getElementById('app');
const token = new URLSearchParams(location.search).get('t');
let schedule = {};
let personData = null;
let saved = false;

let member = null;

async function load() {
  if (!token) return renderError();
  try {
    const { roster } = await window.itexStore.fetchRosterWithSha();
    member = roster.find((m) => m.access_token === token);
  } catch {
    member = null;
  }
  if (!member) return renderError();
  personData = { full_name: member.full_name, position_title: member.position_title };
  schedule = { ...member.schedule };
  render();
}

function renderError() {
  app.innerHTML = `
    <div class="error-box">
      <p style="font-weight:700;font-size:15px;">${isAr() ? 'رابط الحضور غير صحيح' : 'Invalid attendance link'}</p>
      <p style="color:#889;font-size:13px;">${isAr() ? 'يرجى التأكد من الرابط الذي تم إرساله إليك.' : 'Please double-check the link that was sent to you.'}</p>
    </div>`;
}

function allChosen() {
  return EVENT_DATES.every((d) => !!schedule[d]);
}

async function save() {
  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.textContent = isAr() ? '...جارٍ الحفظ' : 'Saving...';
  const days = EVENT_DATES.map((event_date) => ({ event_date, attendance_type: schedule[event_date] }));
  try {
    await window.itexStore.updateRoster((roster) => {
      const m = roster.find((r) => r.access_token === token);
      if (m) {
        for (const { event_date, attendance_type } of days) m.schedule[event_date] = attendance_type;
        m.updated_at = new Date().toISOString();
      }
      return roster;
    });
    saved = true;
  } catch {
    saved = false;
    alert(isAr() ? 'تعذر الحفظ، حاول مرة أخرى.' : 'Save failed, please try again.');
  }
  btn.disabled = false;
  render();
}

function render() {
  if (!personData) return;

  const dayCards = EVENT_DATES.map((date) => {
    const opts = TYPE_OPTIONS.map((opt) => {
      const active = schedule[date] === opt.value;
      return `<button type="button" class="opt${active ? ' active' : ''}" data-date="${date}" data-type="${opt.value}">
        ${isAr() ? opt.ar : opt.en}${opt.hint ? `<small>${opt.hint}</small>` : ''}
      </button>`;
    }).join('');
    return `<div class="card">
      <p class="day-title">${isAr() ? DAY_LABELS[date].ar : DAY_LABELS[date].en}</p>
      <div class="options">${opts}</div>
    </div>`;
  }).join('');

  app.innerHTML = `
    <div style="text-align:center;margin-bottom:18px;">
      <h1>${isAr() ? 'تنظيم حضور أعضاء نقابة المبرمجين العراقيين' : 'Iraqi Programmers Syndicate — ITEX 2026 Attendance'}</h1>
      <p class="tagline">${isAr() ? 'معرض ITEX 2026 – معرض بغداد الدولي' : 'ITEX 2026 – Baghdad International Fair'}</p>
      <p class="subtagline">${isAr() ? 'بوث نقابة المبرمجين العراقيين' : 'Iraqi Programmers Syndicate booth'}</p>
    </div>

    <div class="card">
      <p class="person-name">${personData.full_name}</p>
      ${personData.position_title ? `<p class="person-role">${personData.position_title}</p>` : ''}
      <p class="hours-note">${isAr() ? 'وقت المعرض: 10:00 صباحاً – 8:00 مساءً' : 'Fair hours: 10:00 AM – 8:00 PM'}</p>
    </div>

    ${dayCards}

    <div class="save-bar">
      ${!allChosen() ? `<p class="hint">${isAr() ? 'اختر حالة الحضور لكل الأيام الأربعة قبل الحفظ.' : 'Choose a status for all four days before saving.'}</p>` : ''}
      <button id="saveBtn" class="primary" ${!allChosen() ? 'disabled' : ''}>
        ${isAr() ? 'حفظ جدول الحضور' : 'Save attendance schedule'}
      </button>
      ${saved ? `<p class="success">✓ ${isAr() ? 'تم حفظ جدول حضورك بنجاح.' : 'Your attendance schedule has been saved.'}</p>` : ''}
    </div>
  `;

  app.querySelectorAll('.opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      schedule[btn.dataset.date] = btn.dataset.type;
      saved = false;
      render();
    });
  });
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) saveBtn.addEventListener('click', save);
}

document.body.classList.toggle('ltr', lang === 'en');
load();
