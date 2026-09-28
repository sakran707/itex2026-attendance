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

const CATEGORY_LABELS = {
  leadership: { ar: 'نقيب ونائب النقيب', en: 'President & Vice President' },
  council: { ar: 'أعضاء مجلس النقابة', en: 'Syndicate Council Members' },
  fund_committee: { ar: 'لجنة صندوق النقابة', en: 'Fund Committee' },
  other: { ar: 'مناصب أخرى', en: 'Other Positions' },
};
const CATEGORY_ORDER = ['leadership', 'council', 'fund_committee', 'other'];

const TYPE_SHORT = {
  full_day: { ar: 'كامل', en: 'Full' },
  morning: { ar: 'صباحي', en: 'AM' },
  evening: { ar: 'مسائي', en: 'PM' },
  unavailable: { ar: 'غير متاح', en: 'N/A' },
};

function buildDaySummary(roster, date) {
  const byType = { full_day: [], morning: [], evening: [], unavailable: [] };
  for (const person of roster) {
    const type = person.schedule[date];
    if (type) byType[type].push(person.full_name);
  }
  return byType;
}

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
let roster = null;
let member = null;
let schedule = {};
let saved = false;
let loadError = false;

async function load() {
  try {
    const res = await window.itexStore.fetchRosterWithSha();
    roster = res.roster;
  } catch {
    loadError = true;
  }
  render();
}

function pickPerson(id) {
  member = roster.find((m) => m.id === id);
  schedule = { ...member.schedule };
  saved = false;
  render();
}

function changePerson() {
  member = null;
  render();
}

function allChosen() {
  return EVENT_DATES.every((d) => !!schedule[d]);
}

async function save() {
  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.textContent = isAr() ? '...جارٍ الحفظ' : 'Saving...';
  const id = member.id;
  const days = EVENT_DATES.map((event_date) => ({ event_date, attendance_type: schedule[event_date] }));
  try {
    const updated = await window.itexStore.updateRoster((r) => {
      const m = r.find((x) => x.id === id);
      if (m) {
        for (const { event_date, attendance_type } of days) m.schedule[event_date] = attendance_type;
        m.updated_at = new Date().toISOString();
      }
      return r;
    });
    roster = updated;
    member = roster.find((m) => m.id === id);
    saved = true;
  } catch {
    saved = false;
    alert(isAr() ? 'تعذر الحفظ، حاول مرة أخرى.' : 'Save failed, please try again.');
  }
  btn.disabled = false;
  render();
}

function renderPicker() {
  const groups = CATEGORY_ORDER.map((cat) => ({
    cat,
    members: roster.filter((m) => m.category === cat).sort((a, b) => a.sort_order - b.sort_order),
  })).filter((g) => g.members.length);

  return `
    <div style="text-align:center;margin-bottom:18px;">
      <h1>${isAr() ? 'تنظيم حضور أعضاء نقابة المبرمجين العراقيين' : 'Iraqi Programmers Syndicate — ITEX 2026 Attendance'}</h1>
      <p class="tagline">${isAr() ? 'معرض ITEX 2026 – معرض بغداد الدولي' : 'ITEX 2026 – Baghdad International Fair'}</p>
      <p class="subtagline">${isAr() ? 'بوث نقابة المبرمجين العراقيين' : 'Iraqi Programmers Syndicate booth'}</p>
    </div>
    <div class="card" style="margin-bottom:18px;">
      <p style="font-weight:700;font-size:14px;margin:0;">${isAr() ? 'اختر اسمك من القائمة' : 'Select your name from the list'}</p>
    </div>
    ${groups
      .map(
        (g) => `
      <p class="group-title">${isAr() ? CATEGORY_LABELS[g.cat].ar : CATEGORY_LABELS[g.cat].en}</p>
      <div class="card" style="padding:6px;">
        ${g.members
          .map(
            (m) => `
          <button type="button" class="person-pick" data-id="${m.id}" style="display:block;width:100%;text-align:${isAr() ? 'right' : 'left'};background:none;border:none;border-bottom:1px solid var(--border);padding:12px 10px;font-size:13.5px;font-weight:600;color:var(--ink);cursor:pointer;">
            ${m.full_name}${m.position_title ? `<br><span style="font-weight:500;font-size:12px;color:#889;">${m.position_title}</span>` : ''}
          </button>`,
          )
          .join('')}
      </div>`,
      )
      .join('')}
  `;
}

function renderError() {
  app.innerHTML = `
    <div class="error-box">
      <p style="font-weight:700;font-size:15px;">${isAr() ? 'تعذر تحميل البيانات' : 'Could not load data'}</p>
      <p style="color:#889;font-size:13px;">${isAr() ? 'يرجى تحديث الصفحة والمحاولة مرة أخرى.' : 'Please refresh the page and try again.'}</p>
    </div>`;
}

function render() {
  if (loadError) return renderError();
  if (!roster) return;

  if (!member) {
    app.innerHTML = renderPicker();
    app.querySelectorAll('.person-pick').forEach((btn) => {
      btn.addEventListener('click', () => pickPerson(Number(btn.dataset.id)));
    });
    return;
  }

  const dayCards = EVENT_DATES.map((date) => {
    const opts = TYPE_OPTIONS.map((opt) => {
      const active = schedule[date] === opt.value;
      return `<button type="button" class="opt${active ? ' active' : ''}" data-date="${date}" data-type="${opt.value}">
        ${isAr() ? opt.ar : opt.en}${opt.hint ? `<small>${opt.hint}</small>` : ''}
      </button>`;
    }).join('');

    const daySummary = buildDaySummary(roster, date);
    const counts = ['full_day', 'morning', 'evening', 'unavailable']
      .map((t) => `${isAr() ? TYPE_SHORT[t].ar : TYPE_SHORT[t].en}: <b class="num">${daySummary[t].length}</b>`)
      .join(' · ');
    const namesByType = ['full_day', 'morning', 'evening', 'unavailable']
      .map((t) =>
        daySummary[t].length
          ? `<div style="margin-top:6px;"><b>${isAr() ? TYPE_SHORT[t].ar : TYPE_SHORT[t].en}:</b> ${daySummary[t].join('، ')}</div>`
          : '',
      )
      .join('');

    return `<div class="card">
      <p class="day-title">${isAr() ? DAY_LABELS[date].ar : DAY_LABELS[date].en}</p>
      <div class="options">${opts}</div>
      <details style="margin-top:10px;">
        <summary style="cursor:pointer;font-size:12px;color:var(--ocean);font-weight:700;">${counts}</summary>
        <div style="font-size:12px;color:#556;margin-top:4px;">${namesByType || `<span style="color:#ccd;">${isAr() ? 'لا أحد بعد' : 'No one yet'}</span>`}</div>
      </details>
    </div>`;
  }).join('');

  app.innerHTML = `
    <div style="text-align:center;margin-bottom:18px;">
      <h1>${isAr() ? 'تنظيم حضور أعضاء نقابة المبرمجين العراقيين' : 'Iraqi Programmers Syndicate — ITEX 2026 Attendance'}</h1>
      <p class="tagline">${isAr() ? 'معرض ITEX 2026 – معرض بغداد الدولي' : 'ITEX 2026 – Baghdad International Fair'}</p>
      <p class="subtagline">${isAr() ? 'بوث نقابة المبرمجين العراقيين' : 'Iraqi Programmers Syndicate booth'}</p>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
        <div>
          <p class="person-name">${member.full_name}</p>
          ${member.position_title ? `<p class="person-role">${member.position_title}</p>` : ''}
        </div>
        <button type="button" id="changePersonBtn" style="background:none;border:none;color:var(--ocean);font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">${isAr() ? 'لست أنا' : 'Not me'}</button>
      </div>
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
  document.getElementById('changePersonBtn')?.addEventListener('click', changePerson);
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) saveBtn.addEventListener('click', save);
}

document.body.classList.toggle('ltr', lang === 'en');
load();
