const STATUS_LABEL = { ongoing: 'Live', upcoming: 'Upcoming', finished: 'Finished' };
const STATUS_ORDER = { ongoing: 0, upcoming: 1, finished: 2 };

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function cardHTML(t) {
  const dateRange = t.endDate && t.endDate !== t.startDate
    ? `${fmtDate(t.startDate)} → ${fmtDate(t.endDate)}`
    : fmtDate(t.startDate);
  return `
  <div class="card tourney-card" data-status="${t.status}">
    <div class="top-row">
      <div>
        <div class="game">${t.game || 'Esports'}</div>
        <h3>${t.name}</h3>
      </div>
      <span class="pill ${t.status}">${STATUS_LABEL[t.status] || t.status}</span>
    </div>
    ${t.description ? `<p>${t.description}</p>` : ''}
    <div class="tourney-meta">
      <div><span>Dates</span><b>${dateRange}</b></div>
      <div><span>Format</span><b>${t.format || '—'}</b></div>
      <div><span>Prize pool</span><b>${t.prizePool || '—'}</b></div>
      <div><span>Teams / players</span><b>${t.teams || '—'}</b></div>
    </div>
    ${t.resultsSummary ? `<div class="hint" style="border-top:1px solid var(--line);padding-top:10px;margin-top:4px;"><b style="color:#fff;">Result:</b> ${t.resultsSummary}</div>` : ''}
    ${t.registrationLink ? `<a href="${t.registrationLink}" class="btn sm" target="_blank" rel="noopener">Register / Details →</a>` : ''}
  </div>`;
}

async function loadTournaments() {
  const board = document.getElementById('board');
  try {
    const res = await fetch('assets/data/tournaments.json?_=' + Date.now());
    if (!res.ok) throw new Error('not found');
    const data = await res.json();
    let list = (data.tournaments || []).slice();
    list.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
      || new Date(b.startDate || 0) - new Date(a.startDate || 0));

    if (!list.length) {
      board.innerHTML = emptyState();
      return;
    }
    render(list);

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const f = btn.dataset.filter;
        render(f === 'all' ? list : list.filter(t => t.status === f));
      });
    });
  } catch (e) {
    board.innerHTML = emptyState();
  }

  function render(items) {
    board.innerHTML = items.length
      ? `<div class="grid-3">${items.map(cardHTML).join('')}</div>`
      : `<div class="empty-state"><h3>Nothing in this category yet</h3><p>Check back once the next tournament is posted.</p></div>`;
  }
}

function emptyState() {
  return `<div class="empty-state"><h3>No tournaments posted yet</h3><p>The board updates the moment the next Rotten Republic event is announced.</p></div>`;
}

document.addEventListener('DOMContentLoaded', loadTournaments);