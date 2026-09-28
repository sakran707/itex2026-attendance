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

const app = document.getElementById('app');
const logoutBtn = document.getElementById('logoutBtn');
let tab = 'roster';
let data = null;

async function checkSession() {
  const res = await fetch('/api/admin?action=session');
  const { isAdmin } = await res.json();
  if (isAdmin) {
    logoutBtn.style.display = 'inline-block';
    await loadData();
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
  document.getElementById('loginBtn').addEventListener('click', async () => {
    const password = document.getElementById('pw').value;
    const res = await fetch('/api/admin?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
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

async function loadData() {
  const res = await fetch('/api/admin?action=members');
  if (res.status === 401) return renderLogin();
  data = await res.json();
  render();
}

function copyLink(token) {
  const url = `${location.origin}/?t=${token}`;
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
              <td><button class="link-btn" data-token="${m.access_token}">نسخ الرابط</button></td>
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

function render() {
  app.innerHTML = `
    <div class="tabs">
      <button data-tab="roster" class="${tab === 'roster' ? 'active' : ''}">جدول الأعضاء</button>
      <button data-tab="summary" class="${tab === 'summary' ? 'active' : ''}">الملخص اليومي</button>
    </div>
    ${tab === 'roster' ? renderRoster() : renderSummary()}
  `;
  app.querySelectorAll('.tabs button').forEach((b) =>
    b.addEventListener('click', () => {
      tab = b.dataset.tab;
      render();
    }),
  );
  app.querySelectorAll('.link-btn').forEach((b) => b.addEventListener('click', () => copyLink(b.dataset.token)));
}

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/admin?action=logout', { method: 'POST' });
  renderLogin();
});

checkSession();
