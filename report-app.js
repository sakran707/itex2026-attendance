const SESSION_KEY = 'itex_admin_session';
if (localStorage.getItem(SESSION_KEY) !== '1') {
  location.href = 'admin.html';
}

const EVENT_DATES = ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'];

const DAY_LABELS = {
  '2026-09-30': 'الأربعاء 30/9/2026',
  '2026-10-01': 'الخميس 1/10/2026',
  '2026-10-02': 'الجمعة 2/10/2026',
  '2026-10-03': 'السبت 3/10/2026',
};

const TYPE_LABELS = {
  full_day: 'يوم كامل',
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

function badge(type) {
  if (!type) return `<span class="badge muted">—</span>`;
  return `<span class="badge ${type}">${TYPE_LABELS[type]}</span>`;
}

/** Council members have no individual title in the roster data — fall back
 * to a generic "council member" label instead of showing nothing. */
function displayTitle(m) {
  if (m.position_title) return m.position_title;
  if (m.category === 'council') return 'عضو مجلس نقابة';
  return null;
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

function rosterTable(roster) {
  const rows = CATEGORY_ORDER.flatMap((cat) => {
    const members = roster.filter((m) => m.category === cat).sort((a, b) => a.sort_order - b.sort_order);
    if (!members.length) return [];
    return [
      `<tr class="category-row"><td colspan="7">${CATEGORY_LABELS[cat]}</td></tr>`,
      ...members.map(
        (m, i) => `<tr>
          <td>${i + 1}</td>
          <td style="font-weight:600;">${m.full_name}</td>
          <td>${displayTitle(m) ?? '—'}</td>
          ${EVENT_DATES.map((d) => `<td>${badge(m.schedule[d])}</td>`).join('')}
        </tr>`,
      ),
    ];
  });

  return `
    <table>
      <thead>
        <tr>
          <th>#</th><th>الاسم</th><th>المنصب</th>
          ${EVENT_DATES.map((d) => `<th>${DAY_LABELS[d]}</th>`).join('')}
        </tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
    </table>`;
}

function dailySummaryBlocks(summary) {
  return EVENT_DATES
    .map((date) => {
      const s = summary[date];
      const boxes = ['full_day', 'morning', 'evening', 'unavailable']
        .map((type) => {
          const names = s[type] ?? [];
          const isShift = type === 'morning' || type === 'evening';
          const coverage = isShift
            ? names.length === 0
              ? `<span class="warn">⚠️ لا يوجد تغطية</span>`
              : `<span class="ok">✓ مغطى</span>`
            : '';
          return `<div class="shift-box">
            <div class="label"><span>${TYPE_LABELS[type]}</span><span>${names.length}</span></div>
            ${coverage}
            <ul>${names.length ? names.map((n) => `<li>${n}</li>`).join('') : '<li>—</li>'}</ul>
          </div>`;
        })
        .join('');
      return `<div class="day-block">
        <h3>${DAY_LABELS[date]}</h3>
        <div class="shift-grid">${boxes}</div>
      </div>`;
    })
    .join('');
}

async function render() {
  const sheet = document.getElementById('sheet');
  try {
    const { roster } = await window.itexStore.fetchRosterWithSha();
    const summary = buildSummary(roster);
    const now = new Date();
    const printedAt = now.toLocaleString('ar-IQ', { dateStyle: 'long', timeStyle: 'short' });
    const registered = roster.filter((m) => m.updated_at).length;

    sheet.innerHTML = `
      <div class="report-header">
        <h1>تقرير حضور أعضاء نقابة المبرمجين العراقيين</h1>
        <p class="sub">معرض ITEX 2026 – معرض بغداد الدولي — بوث نقابة المبرمجين العراقيين</p>
        <p class="meta">تاريخ الطباعة: ${printedAt} — عدد المسجّلين: ${registered} من ${roster.length}</p>
      </div>

      <h2 class="section">جدول الحضور الكامل</h2>
      ${rosterTable(roster)}

      <h2 class="section">الملخص اليومي حسب الشفت</h2>
      ${dailySummaryBlocks(summary)}

      <p class="footer-note">نقابة المبرمجين العراقيين — تقرير مُولَّد تلقائياً من نظام تنظيم الحضور</p>
    `;
  } catch {
    sheet.innerHTML = `<p style="text-align:center;padding:60px 0;color:#c0392b;">تعذر تحميل التقرير، حاول تحديث الصفحة.</p>`;
  }
}

document.getElementById('printBtn').addEventListener('click', () => window.print());
render();
