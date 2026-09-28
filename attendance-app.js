const EVENT_DATES = ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'];

const DAY_LABELS = {
  '2026-09-30': { ar: 'الأربعاء 30/9/2026', en: 'Wed 9/30/2026' },
  '2026-10-01': { ar: 'الخميس 1/10/2026', en: 'Thu 10/1/2026' },
  '2026-10-02': { ar: 'الجمعة 2/10/2026', en: 'Fri 10/2/2026' },
  '2026-10-03': { ar: 'السبت 3/10/2026', en: 'Sat 10/3/2026' },
};

const TYPE_OPTIONS = [
  { value: 'full_day', ar: 'يوم كامل', en: 'Full day', hint_ar: '10:00 ص – 8:00 م', hint_en: '10:00 AM – 8:00 PM' },
  { value: 'morning', ar: 'الشفت الصباحي', en: 'Morning shift', hint_ar: '10:00 ص – 3:00 م', hint_en: '10:00 AM – 3:00 PM' },
  { value: 'evening', ar: 'الشفت المسائي', en: 'Evening shift', hint_ar: '3:00 م – 8:00 م', hint_en: '3:00 PM – 8:00 PM' },
  { value: 'unavailable', ar: 'غير متاح', en: 'Unavailable', hint_ar: '', hint_en: '' },
];

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
let searchTerm = '';

async function load() {
  try {
    const res = await window.itexStore.fetchRosterWithSha();
    roster = res.roster;
  } catch {
    loadError = true;
  }
  render();
}

/** Refreshes the shared roster in the background so shift counts stay live
 * without the person needing to reload the page. Never touches the current
 * `member`/`schedule` (their own in-progress picks), only the counts shown
 * for everyone. */
async function pollRoster() {
  try {
    const res = await window.itexStore.fetchRosterWithSha();
    roster = res.roster;
    render();
  } catch {
    // transient network hiccup — keep showing the last known data
  }
}
setInterval(pollRoster, 15000);

function pickPerson(id) {
  member = roster.find((m) => m.id === id);
  schedule = { ...member.schedule };
  // Already picked something before? Go straight to the confirmation screen
  // instead of making them click through the form again.
  saved = EVENT_DATES.every((d) => !!schedule[d]);
  render();
}

function changePerson() {
  member = null;
  render();
}

function editAgain() {
  saved = false;
  render();
}

/** Lets someone exit without choosing (or finishing) anything — still ends on
 * a polite thank-you screen instead of leaving them stuck on the form. */
function skipWithoutChoosing() {
  saved = true;
  render();
}

function backToStart() {
  member = null;
  saved = false;
  searchTerm = '';
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
    const updated = await window.itexStore.updateRoster(
      (r) => {
        const m = r.find((x) => x.id === id);
        if (m) {
          for (const { event_date, attendance_type } of days) m.schedule[event_date] = attendance_type;
          m.updated_at = new Date().toISOString();
        }
        return r;
      },
      () => {
        // Several people can be saving at once — retrying is normal, not broken.
        if (btn) btn.textContent = isAr() ? 'الخادم مزدحم، جارٍ إعادة المحاولة...' : 'Busy, retrying...';
      },
    );
    roster = updated;
    member = roster.find((m) => m.id === id);
    saved = true;
  } catch {
    saved = false;
    alert(
      isAr()
        ? 'تعذر الحفظ بعد عدة محاولات (ازدحام مؤقت). اضغط "حفظ جدول الحضور" مرة أخرى.'
        : 'Save failed after several attempts (temporary congestion). Press "Save attendance schedule" again.',
    );
  }
  btn.disabled = false;
  render();
}

function renderPicker() {
  const term = searchTerm.trim();
  const matches = term ? roster.filter((m) => m.full_name.includes(term)) : [];

  const resultsHtml = !term
    ? ''
    : matches.length
      ? `<div class="card" style="padding:6px;">
          ${matches
            .map(
              (m) => `
            <button type="button" class="person-pick" data-id="${m.id}" style="display:block;width:100%;text-align:${isAr() ? 'right' : 'left'};background:none;border:none;border-bottom:1px solid var(--border);padding:12px 10px;font-size:13.5px;font-weight:600;color:var(--ink);cursor:pointer;">
              ${m.full_name}${m.position_title ? `<br><span style="font-weight:500;font-size:12px;color:#889;">${m.position_title}</span>` : ''}
            </button>`,
            )
            .join('')}
        </div>`
      : `<p style="text-align:center;color:#889;font-size:13px;">${isAr() ? 'لا يوجد اسم مطابق' : 'No matching name'}</p>`;

  return `
    <div style="text-align:center;margin-bottom:18px;">
      <h1>${isAr() ? 'تنظيم حضور أعضاء نقابة المبرمجين العراقيين' : 'Iraqi Programmers Syndicate — ITEX 2026 Attendance'}</h1>
      <p class="tagline">${isAr() ? 'معرض ITEX 2026 – معرض بغداد الدولي' : 'ITEX 2026 – Baghdad International Fair'}</p>
      <p class="subtagline">${isAr() ? 'بوث نقابة المبرمجين العراقيين' : 'Iraqi Programmers Syndicate booth'}</p>
    </div>
    <div class="card" style="margin-bottom:18px;">
      <p style="font-weight:700;font-size:14px;margin:0 0 8px;">${isAr() ? 'اكتب اسمك للبحث' : 'Type your name to search'}</p>
      <input id="nameSearch" type="text" value="${term.replace(/"/g, '&quot;')}" placeholder="${isAr() ? 'اكتب اسمك...' : 'Type your name...'}"
        style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px;" />
    </div>
    ${resultsHtml}
  `;
}

function renderThankYou() {
  const anyChosen = EVENT_DATES.some((d) => schedule[d]);

  const rows = EVENT_DATES.map((date) => {
    const opt = TYPE_OPTIONS.find((o) => o.value === schedule[date]);
    return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
      <span>${isAr() ? DAY_LABELS[date].ar : DAY_LABELS[date].en}</span>
      <span style="font-weight:700;${opt ? '' : 'color:#ccd;font-weight:500;'}">${
        opt ? (isAr() ? opt.ar : opt.en) : isAr() ? 'لم يُحدَّد' : 'Not set'
      }</span>
    </div>`;
  }).join('');

  const message = anyChosen
    ? isAr()
      ? 'تم حفظ جدول حضورك بنجاح.'
      : 'Your attendance schedule has been saved.'
    : isAr()
      ? 'تم تسجيل خروجك بدون اختيار. شكرًا لك على أي حال.'
      : 'You exited without choosing. Thanks anyway.';

  return `
    <div style="text-align:center;padding:40px 16px 20px;">
      <div style="font-size:44px;line-height:1;margin-bottom:10px;">✅</div>
      <h1 style="margin-bottom:6px;">${isAr() ? `شكرًا لك، ${member.full_name.split(' ')[0]}!` : `Thank you, ${member.full_name.split(' ')[0]}!`}</h1>
      <p class="tagline" style="margin-bottom:2px;">${message}</p>
      <p class="subtagline">${isAr() ? 'نشكرك على وقتك ودعمك للنقابة' : 'Thank you for your time and support'}</p>
    </div>

    <div class="card">
      <p style="font-weight:700;font-size:13.5px;margin-bottom:8px;">${isAr() ? 'ملخص اختيارك' : 'Your schedule'}</p>
      ${rows}
    </div>

    <div style="margin-top:16px;display:flex;flex-direction:column;gap:8px;">
      <button type="button" id="editAgainBtn" style="background:none;border:1px solid var(--border);border-radius:8px;padding:11px;font-size:13px;font-weight:700;color:var(--ink);cursor:pointer;">
        ${isAr() ? 'تعديل اختياري' : 'Edit my schedule'}
      </button>
      <button type="button" id="backToStartBtn" style="background:none;border:none;color:var(--ocean);font-size:12.5px;font-weight:700;cursor:pointer;padding:8px;">
        ${isAr() ? 'إنهاء (لشخص آخر يستخدم هذا الجهاز)' : 'Done (for someone else using this device)'}
      </button>
    </div>
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
    const searchInput = document.getElementById('nameSearch');
    searchInput.addEventListener('input', () => {
      searchTerm = searchInput.value;
      render();
    });
    if (searchTerm) {
      searchInput.focus();
      const pos = searchInput.value.length;
      searchInput.setSelectionRange(pos, pos);
    }
    return;
  }

  if (saved) {
    app.innerHTML = renderThankYou();
    document.getElementById('editAgainBtn')?.addEventListener('click', editAgain);
    document.getElementById('backToStartBtn')?.addEventListener('click', backToStart);
    return;
  }

  const dayCards = EVENT_DATES.map((date) => {
    const daySummary = buildDaySummary(roster, date);

    const opts = TYPE_OPTIONS.map((opt) => {
      const active = schedule[date] === opt.value;
      const hint = isAr() ? opt.hint_ar : opt.hint_en;
      const names = opt.value === 'unavailable' ? [] : daySummary[opt.value].filter((n) => n !== member.full_name);
      return `<div>
        <button type="button" class="opt${active ? ' active' : ''}" data-date="${date}" data-type="${opt.value}" style="width:100%;">
          ${isAr() ? opt.ar : opt.en}${hint ? `<small>${hint}</small>` : ''}
        </button>${
          names.length
            ? `<div style="font-size:10.5px;color:#778;margin:4px 2px 0;">
                <span style="font-weight:600;">${isAr() ? 'موجود أيضاً:' : 'Also there:'}</span>
                ${names.map((n) => `<div style="margin-top:2px;">${n}</div>`).join('')}
              </div>`
            : ''
        }
      </div>`;
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
      <button type="button" id="skipBtn" style="background:none;border:none;color:#889;font-size:12px;font-weight:600;cursor:pointer;padding:10px;">
        ${isAr() ? 'لا أريد الاختيار الآن، خروج' : "I don't want to choose now, exit"}
      </button>
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
  document.getElementById('skipBtn')?.addEventListener('click', skipWithoutChoosing);
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) saveBtn.addEventListener('click', save);
}

document.body.classList.toggle('ltr', lang === 'en');
load();
