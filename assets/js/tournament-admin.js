const LS_KEY = 'trr_tournaments_draft';

let tournaments = [];
let editingIndex = null;

const els = {};

document.addEventListener('DOMContentLoaded', () => {
  els.list = document.getElementById('adminList');
  els.form = document.getElementById('tForm');
  els.formTitle = document.getElementById('formTitle');
  els.saveBtn = document.getElementById('saveBtn');
  els.cancelEdit = document.getElementById('cancelEdit');
  els.fileInput = document.getElementById('fileInput');

  loadDraft();
  render();

  els.form.addEventListener('submit', onSubmit);
  els.cancelEdit.addEventListener('click', resetForm);
  document.getElementById('loadFromSite').addEventListener('click', loadFromSite);
  document.getElementById('loadFromFileBtn').addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', loadFromFile);
  document.getElementById('exportBtn').addEventListener('click', exportJSON);
  document.getElementById('clearAll').addEventListener('click', () => {
    if (confirm('Clear every tournament from the working draft? This does not touch the live file until you export.')) {
      tournaments = [];
      saveDraft();
      render();
    }
  });
});

function loadDraft() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) tournaments = JSON.parse(raw);
  } catch (e) { tournaments = []; }
}
function saveDraft() {
  localStorage.setItem(LS_KEY, JSON.stringify(tournaments));
}

async function loadFromSite() {
  try {
    const res = await fetch('assets/data/tournaments.json?_=' + Date.now());
    const data = await res.json();
    tournaments = data.tournaments || [];
    saveDraft();
    render();
    trrToast('Loaded the live tournaments.json into your working draft.');
  } catch (e) {
    trrToast('Could not load the live file — import it manually below instead.');
  }
}

function loadFromFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      tournaments = data.tournaments || [];
      saveDraft();
      render();
      trrToast('File imported into your working draft.');
    } catch (err) {
      trrToast('That file isn\'t valid JSON — check it and try again.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'tournament';
}

function onSubmit(e) {
  e.preventDefault();
  const fd = new FormData(els.form);
  const name = fd.get('name').trim();
  if (!name) return;

  let id = fd.get('id').trim() || slugify(name);
  // ensure unique id
  let base = id, n = 2;
  while (tournaments.some((t, i) => t.id === id && i !== editingIndex)) { id = base + '-' + n++; }

  const record = {
    id,
    name,
    game: fd.get('game').trim() || 'Honor of Kings',
    status: fd.get('status'),
    startDate: fd.get('startDate'),
    endDate: fd.get('endDate'),
    format: fd.get('format').trim(),
    teams: fd.get('teams').trim(),
    prizePool: fd.get('prizePool').trim(),
    description: fd.get('description').trim(),
    resultsSummary: fd.get('resultsSummary').trim(),
    registrationLink: fd.get('registrationLink').trim()
  };

  if (editingIndex !== null) {
    tournaments[editingIndex] = record;
  } else {
    tournaments.unshift(record);
  }
  saveDraft();
  resetForm();
  render();
  trrToast(editingIndex !== null ? 'Tournament updated.' : 'Tournament added to draft.');
}

function resetForm() {
  els.form.reset();
  editingIndex = null;
  els.formTitle.textContent = 'Add a tournament';
  els.saveBtn.textContent = 'Add to draft';
  els.cancelEdit.style.display = 'none';
}

function editItem(i) {
  const t = tournaments[i];
  editingIndex = i;
  Object.entries(t).forEach(([k, v]) => {
    const field = els.form.elements[k];
    if (field) field.value = v || '';
  });
  els.formTitle.textContent = 'Edit tournament';
  els.saveBtn.textContent = 'Save changes';
  els.cancelEdit.style.display = 'inline-flex';
  window.scrollTo({ top: document.getElementById('editor').offsetTop - 90, behavior: 'smooth' });
}

function deleteItem(i) {
  if (!confirm('Remove "' + tournaments[i].name + '" from the draft?')) return;
  tournaments.splice(i, 1);
  saveDraft();
  render();
}

function render() {
  if (!tournaments.length) {
    els.list.innerHTML = `<div class="empty-state"><h3>Working draft is empty</h3><p>Load the current live file, import a JSON file, or add a new tournament below.</p></div>`;
    return;
  }
  els.list.innerHTML = tournaments.map((t, i) => `
    <div class="panel sm" style="margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:flex-start;">
        <div>
          <span class="pill ${t.status}">${t.status}</span>
          <h3 style="margin-top:10px; font-size:19px;">${t.name}</h3>
          <p class="hint" style="margin:0;">${t.game || ''} · ${t.startDate || '—'}${t.endDate ? ' → ' + t.endDate : ''}</p>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn sm ghost" onclick="editItem(${i})">Edit</button>
          <button class="btn sm ghost" onclick="deleteItem(${i})">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

function exportJSON() {
  const data = { tournaments };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tournaments.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  trrToast('tournaments.json downloaded — upload it to assets/data/ on GitHub to publish.');
}