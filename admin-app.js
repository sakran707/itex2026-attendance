const EVENT_DATES = ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'];

const DAY_LABELS = {
  '2026-09-30': 'الأربعاء 30/9',
  '2026-10-01': 'الخميس 1/10',
  '2026-10-02': 'الجمعة 2/10',
  '2026-10-03': 'السبت 3/10',
};

const TYPE_LABELS = {
  full_day: 'كامل',
  morning: 'صباحي',
  evening: 'مسائي',
  unavailable: 'غير متاح',
};

const CATEGORY_LABELS = {
  leadership: 'نقيب ونائب النقيب',
  council: 'أعضاء مجلس النقابة',
  fund_committee: 'لجنة صندوق النقابة',
  other: 'مناصب أخرى',
};
const CATEGORY_ORDER = ['leadership', 'council', 'fund_committee', 'other'];

const TYPE_OPTIONS = [
  { value: 'full_day', label: 'يوم كامل', hint: '10:00 – 20:00' },
  { value: 'morning', label: 'صباحي', hint: '10:00 – 15:00' },
  { value: 'evening', label: 'مسائي', hint: '15:00 – 20:00' },
  { value: 'unavailable', label: 'غير متاح', hint: '' },
];

const app = document.getElementById('app');
const logoutBtn = document.getElementById('logoutBtn');
let tab = 'roster';
let data = null;
let editingId = null;
let editSchedule = null;
let saving = false;

const SESSION_KEY = 'itex_admin_session';

function checkSession() {
  if (sessionStorage.getItem(SESSION_KEY) === '1') {
    logoutBtn.style.display = 'inline-block';
    loadData();
  } else {
    renderLogin();
  }
}

function renderLogin(error) {
  logoutBtn.style.display = 'none';
  app.innerHTML = `
    <div class="login-box card">
      <p style="font-weight:700;margin-bottom:10px;">دخول المسؤول</p>
      ${error ? `<p class="login-error">كلمة المرور غير صحيحة</p>` : ''}
      <input type="password" id="pw" placeholder="كلمة المرور" />
      <button class="primary" id="loginBtn">دخول</button>
    </div>`;
  document.getElementById('loginBtn').addEventListener('click', () => {
    const password = document.getElementById('pw').value;
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1');
      logoutBtn.style.display = 'inline-block';
      loadData();
    } else {
      renderLogin(true);
    }
  });
  document.getElementById('pw')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('loginBtn').click();
  });
}

function buildSummary(roster) {
  const summary = {};
  for (const date of EVENT_DATES) {
    const byType = { full_day: [], morning: [], evening: [], unavailable: [] };
    for (const person of roster) {
      const type = person.schedule[date];
      if (type) byType[type].push(person.full_name);
    }
    summary[date] = byType;
  }
  return summary;
}

async function loadData() {
  try {
    const { roster } = await window.itexStore.fetchRosterWithSha();
    const members = [...roster].sort((a, b) => a.sort_order - b.sort_order);
    data = { members, summary: buildSummary(roster) };
    render();
  } catch {
    app.innerHTML = `<div class="error-box"><p style="font-weight:700;">تعذر تحميل البيانات، حاول تحديث الصفحة.</p></div>`;
  }
}

function copyLink(token) {
  const base = location.pathname.replace(/admin\.html$/, '');
  const url = `${location.origin}${base}?t=${token}`;
  navigator.clipboard.writeText(url).then(() => alert('تم نسخ الرابط'));
}

function badge(type) {
  if (!type) return `<span class="badge muted">—</span>`;
  return `<span class="badge ${type}">${TYPE_LABELS[type]}</span>`;
}

function renderRoster() {
  const groups = CATEGORY_ORDER
    .map((cat) => ({ cat, members: data.members.filter((m) => m.category === cat) }))
    .filter((g) => g.members.length);

  return groups
    .map(
      (g) => `
    <p class="group-title">${CATEGORY_LABELS[g.cat]}</p>
    <div class="card overflow-x">
      <table>
        <thead><tr>
          <th>الاسم</th><th>المنصب</th>
          ${EVENT_DATES.map((d) => `<th>${DAY_LABELS[d]}</th>`).join('')}
          <th>آخر تحديث</th><th></th>
        </tr></thead>
        <tbody>
          ${g.members
            .map(
              (m) => `
            <tr>
              <td style="font-weight:600;">${m.full_name}</td>
              <td style="color:#889;">${m.position_title ?? '—'}</td>
              ${EVENT_DATES.map((d) => `<td>${badge(m.schedule[d])}</td>`).join('')}
              <td style="color:#aab;">${m.updated_at ? new Date(m.updated_at).toLocaleDateString('ar-IQ') : '—'}</td>
              <td style="white-space:nowrap;">
                <button class="link-btn" data-token="${m.access_token}">نسخ الرابط</button>
                <button class="link-btn" data-edit="${m.id}">تعديل</button>
              </td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>`,
    )
    .join('');
}

function renderSummary() {
  return EVENT_DATES.map((date) => {
    const s = data.summary[date];
    const boxes = ['full_day', 'morning', 'evening', 'unavailable']
      .map((type) => {
        const names = s[type] ?? [];
        const isShift = type === 'morning' || type === 'evening';
        const coverage = isShift
          ? names.length === 0
            ? `<p class="coverage warn">⚠️ لا يوجد تغطية</p>`
            : `<p class="coverage ok">✓ مغطى</p>`
          : '';
        return `<div class="summary-box">
          <div style="display:flex;justify-content:space-between;">
            <strong>${TYPE_LABELS[type]}</strong><span class="count">${names.length}</span>
          </div>
          ${coverage}
          <ul>${names.length ? names.map((n) => `<li>${n}</li>`).join('') : '<li style="color:#ccd;">—</li>'}</ul>
        </div>`;
      })
      .join('');
    return `<div class="card">
      <p class="day-title" style="font-size:14px;">${DAY_LABELS[date]}</p>
      <div class="summary-grid">${boxes}</div>
    </div>`;
  }).join('');
}

function renderEditModal() {
  if (editingId == null) return '';
  const member = data.members.find((m) => m.id === editingId);
  if (!member) return '';

  const dayRows = EVENT_DATES.map(
    (date) => `
    <div style="margin-bottom:10px;">
      <p style="font-size:12.5px;font-weight:700;margin:0 0 6px;">${DAY_LABELS[date]}</p>
      <div class="options">
        ${TYPE_OPTIONS.map(
          (opt) => `
          <button type="button" class="opt${editSchedule[date] === opt.value ? ' active' : ''}" data-date="${date}" data-type="${opt.value}">
            ${opt.label}${opt.hint ? `<small>${opt.hint}</small>` : ''}
          </button>`,
        ).join('')}
      </div>
    </div>`,
  ).join('');

  return `
    <div style="position:fixed;inset:0;background:rgba(9,38,52,.5);display:flex;align-items:center;justify-content:center;padding:16px;z-index:50;">
      <div class="card" style="max-width:480px;width:100%;max-height:85vh;overflow-y:auto;">
        <p style="font-weight:700;margin:0 0 4px;">${member.full_name}</p>
        <p style="color:#889;font-size:12.5px;margin:0 0 14px;">${member.position_title ?? ''}</p>
        ${dayRows}
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button class="primary" id="modalSaveBtn" ${saving ? 'disabled' : ''}>${saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
          <button id="modalCancelBtn" style="flex:0 0 auto;background:#eef0f2;border:none;border-radius:8px;padding:0 16px;font-weight:700;cursor:pointer;">إلغاء</button>
        </div>
      </div>
    </div>`;
}

function render() {
  app.innerHTML = `
    <div class="tabs">
      <button data-tab="roster" class="${tab === 'roster' ? 'active' : ''}">جدول الأعضاء</button>
      <button data-tab="summary" class="${tab === 'summary' ? 'active' : ''}">الملخص اليومي</button>
    </div>
    ${tab === 'roster' ? renderRoster() : renderSummary()}
    ${renderEditModal()}
  `;
  app.querySelectorAll('.tabs button').forEach((b) =>
    b.addEventListener('click', () => {
      tab = b.dataset.tab;
      render();
    }),
  );
  app.querySelectorAll('.link-btn[data-token]').forEach((b) => b.addEventListener('click', () => copyLink(b.dataset.token)));
  app.querySelectorAll('.link-btn[data-edit]').forEach((b) =>
    b.addEventListener('click', () => {
      editingId = Number(b.dataset.edit);
      const member = data.members.find((m) => m.id === editingId);
      editSchedule = { ...member.schedule };
      render();
    }),
  );
  app.querySelectorAll('.opt').forEach((b) =>
    b.addEventListener('click', () => {
      editSchedule[b.dataset.date] = b.dataset.type;
      render();
    }),
  );
  document.getElementById('modalCancelBtn')?.addEventListener('click', () => {
    editingId = null;
    editSchedule = null;
    render();
  });
  document.getElementById('modalSaveBtn')?.addEventListener('click', async () => {
    saving = true;
    render();
    const id = editingId;
    const days = EVENT_DATES.filter((d) => editSchedule[d]).map((event_date) => ({ event_date, attendance_type: editSchedule[event_date] }));
    try {
      await window.itexStore.updateRoster((roster) => {
        const m = roster.find((r) => r.id === id);
        if (m) {
          for (const { event_date, attendance_type } of days) m.schedule[event_date] = attendance_type;
          m.updated_at = new Date().toISOString();
        }
        return roster;
      });
      editingId = null;
      editSchedule = null;
      saving = false;
      await loadData();
    } catch {
      saving = false;
      alert('تعذر الحفظ، حاول مرة أخرى.');
      render();
    }
  });
}

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem(SESSION_KEY);
  renderLogin();
});

checkSession();
