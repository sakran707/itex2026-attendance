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
  { value: 'full_day', label: 'يوم كامل', hint: '10:00 ص – 6:00 م' },
  { value: 'morning', label: 'صباحي', hint: '10:00 ص – 2:00 م' },
  { value: 'evening', label: 'مسائي', hint: '2:00 م – 6:00 م' },
  { value: 'unavailable', label: 'غير متاح', hint: '' },
];

/** Council members have no individual title in the roster data — fall back
 * to a generic "council member" label instead of showing nothing. */
function displayTitle(m) {
  if (m.position_title) return m.position_title;
  if (m.category === 'council') return 'عضو مجلس نقابة';
  return null;
}

const app = document.getElementById('app');
const logoutBtn = document.getElementById('logoutBtn');
let tab = 'roster';
let data = null;
let editingId = null;
let editSchedule = null;
let saving = false;
let saveRetryAttempt = 0;

const SESSION_KEY = 'itex_admin_session';

function checkSession() {
  if (localStorage.getItem(SESSION_KEY) === '1') {
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
      localStorage.setItem(SESSION_KEY, '1');
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

function copySharedLink() {
  const base = location.pathname.replace(/admin\.html$/, '');
  const url = `${location.origin}${base}`;
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
              <td style="color:#889;">${displayTitle(m) ?? '—'}</td>
              ${EVENT_DATES.map((d) => `<td>${badge(m.schedule[d])}</td>`).join('')}
              <td style="color:#aab;">${m.updated_at ? new Date(m.updated_at).toLocaleDateString('ar-IQ') : '—'}</td>
              <td style="white-space:nowrap;">
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
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <p style="font-size:12.5px;font-weight:700;margin:0;">${DAY_LABELS[date]}</p>
        ${
          editSchedule[date]
            ? `<button type="button" class="link-btn" data-clear-day="${date}" style="color:#c0392b;padding:0;">✕ إلغاء الاختيار</button>`
            : ''
        }
      </div>
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
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <p style="font-weight:700;margin:0 0 4px;">${member.full_name}</p>
            <p style="color:#889;font-size:12.5px;margin:0 0 14px;">${displayTitle(member) ?? ''}</p>
          </div>
          <button type="button" id="clearAllBtn" style="background:none;border:1px solid #f3caca;color:#c0392b;border-radius:6px;font-size:11px;font-weight:700;padding:5px 8px;cursor:pointer;white-space:nowrap;">مسح الكل</button>
        </div>
        ${dayRows}
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button class="primary" id="modalSaveBtn" ${saving ? 'disabled' : ''}>${
    saving ? (saveRetryAttempt > 0 ? 'الخادم مزدحم، جارٍ إعادة المحاولة...' : 'جارٍ الحفظ...') : 'حفظ'
  }</button>
          <button id="modalCancelBtn" style="flex:0 0 auto;background:#eef0f2;border:none;border-radius:8px;padding:0 16px;font-weight:700;cursor:pointer;">إلغاء</button>
        </div>
      </div>
    </div>`;
}

// Coverage color scale for the two working shifts (morning/evening) —
// full_day and unavailable aren't "coverage" concerns so they stay neutral.
function coverageColor(count) {
  if (count === 0) return { bg: '#fdecea', fg: '#c0392b', label: 'لا يوجد' };
  if (count <= 2) return { bg: '#fdf3e0', fg: '#a56a0c', label: 'قليل' };
  return { bg: '#e6f4ec', fg: 'var(--ok)', label: 'جيد' };
}

function renderCoverageGlance() {
  return `
    <div style="margin-top:12px;">
      <p style="font-weight:700;font-size:12.5px;margin:0 0 8px;">نظرة سريعة على التغطية — الشفت الصباحي والمسائي</p>
      <div class="overflow-x">
        <table style="font-size:11.5px;">
          <thead>
            <tr>
              <th style="white-space:nowrap;">اليوم</th>
              <th>صباحي</th>
              <th>مسائي</th>
            </tr>
          </thead>
          <tbody>
            ${EVENT_DATES.map((date) => {
              const s = data.summary[date];
              const cells = ['morning', 'evening']
                .map((type) => {
                  const count = (s[type] ?? []).length;
                  const c = coverageColor(count);
                  return `<td>
                    <span style="display:inline-flex;align-items:center;gap:5px;background:${c.bg};color:${c.fg};border-radius:6px;padding:3px 8px;font-weight:700;">
                      <span class="num">${count}</span> <span style="font-weight:600;">${c.label}</span>
                    </span>
                  </td>`;
                })
                .join('');
              return `<tr><td style="font-weight:700;white-space:nowrap;">${DAY_LABELS[date]}</td>${cells}</tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <p style="font-size:10.5px;color:#99a;margin:6px 0 0;">🔴 لا يوجد أحد · 🟠 1-2 أشخاص · 🟢 3 أشخاص فأكثر</p>
    </div>`;
}

function renderProgress() {
  const registered = data.members.filter((m) => EVENT_DATES.some((d) => m.schedule[d]));
  const remaining = data.members
    .filter((m) => EVENT_DATES.every((d) => !m.schedule[d]))
    .sort((a, b) => a.sort_order - b.sort_order);

  return `
    <div class="card" style="margin-top:10px;">
      <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">
        <p style="font-weight:700;font-size:13.5px;margin:0;">من سجّل حضوره</p>
        <span class="num" style="font-weight:700;color:var(--accent);">${registered.length}</span>
        <span style="color:#889;font-size:12.5px;">من ${data.members.length}</span>
      </div>
      ${
        remaining.length
          ? `<details style="margin-top:8px;">
              <summary style="cursor:pointer;font-size:12.5px;color:var(--ocean);font-weight:700;">
                المتبقون بدون أي اختيار (${remaining.length})
              </summary>
              <ol style="margin:8px 0 0;padding-inline-start:20px;font-size:12.5px;color:#445;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:4px 12px;">
                ${remaining
                  .map(
                    (m) =>
                      `<li style="padding:2px 0;">${m.full_name}${displayTitle(m) ? `<br><span style="color:#99a;font-size:11px;">${displayTitle(m)}</span>` : ''}</li>`,
                  )
                  .join('')}
              </ol>
            </details>`
          : `<p style="margin:8px 0 0;font-size:12.5px;color:var(--ok);font-weight:700;">✓ الجميع سجّلوا حضورهم</p>`
      }
      ${renderCoverageGlance()}
    </div>`;
}

function render() {
  app.innerHTML = `
    <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
      <div>
        <p style="font-weight:700;font-size:13.5px;margin:0;">رابط الحضور المشترك</p>
        <p style="color:#889;font-size:12px;margin:2px 0 0;">أرسل هذا الرابط لجميع الأعضاء — كل واحد يختار اسمه بنفسه</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="primary" id="copySharedBtn" style="width:auto;padding:9px 16px;">نسخ الرابط</button>
        <a href="report.html?t=${Date.now()}" target="_blank" style="display:inline-flex;align-items:center;background:var(--ink);color:#fff;border-radius:8px;padding:9px 16px;font-size:13px;font-weight:700;text-decoration:none;">تصدير PDF</a>
      </div>
    </div>
    ${renderProgress()}
    <div class="tabs" style="margin-top:14px;">
      <button data-tab="roster" class="${tab === 'roster' ? 'active' : ''}">جدول الأعضاء</button>
      <button data-tab="summary" class="${tab === 'summary' ? 'active' : ''}">الملخص اليومي</button>
    </div>
    ${tab === 'roster' ? renderRoster() : renderSummary()}
    ${renderEditModal()}
  `;
  document.getElementById('copySharedBtn')?.addEventListener('click', copySharedLink);
  app.querySelectorAll('.tabs button').forEach((b) =>
    b.addEventListener('click', () => {
      tab = b.dataset.tab;
      render();
    }),
  );
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
  app.querySelectorAll('[data-clear-day]').forEach((b) =>
    b.addEventListener('click', () => {
      editSchedule[b.dataset.clearDay] = null;
      render();
    }),
  );
  document.getElementById('clearAllBtn')?.addEventListener('click', () => {
    for (const date of EVENT_DATES) editSchedule[date] = null;
    render();
  });
  document.getElementById('modalCancelBtn')?.addEventListener('click', () => {
    editingId = null;
    editSchedule = null;
    render();
  });
  document.getElementById('modalSaveBtn')?.addEventListener('click', async () => {
    saving = true;
    saveRetryAttempt = 0;
    render();
    const id = editingId;
    // Send all 4 dates (including cleared/null ones) so a cleared day actually
    // overwrites the previously saved choice instead of being skipped.
    const days = EVENT_DATES.map((event_date) => ({ event_date, attendance_type: editSchedule[event_date] ?? null }));
    try {
      await window.itexStore.updateRoster(
        (roster) => {
          const m = roster.find((r) => r.id === id);
          if (m) {
            for (const { event_date, attendance_type } of days) m.schedule[event_date] = attendance_type;
            m.updated_at = new Date().toISOString();
          }
          return roster;
        },
        (attempt) => {
          // Several admins/members can be saving at once — retrying is normal, not broken.
          saveRetryAttempt = attempt;
          render();
        },
      );
      editingId = null;
      editSchedule = null;
      saving = false;
      await loadData();
    } catch {
      saving = false;
      alert('تعذر الحفظ بعد عدة محاولات (ازدحام مؤقت). اضغط "حفظ" مرة أخرى.');
      render();
    }
  });
}

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem(SESSION_KEY);
  renderLogin();
});

checkSession();
