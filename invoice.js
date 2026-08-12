/* ---------------- Org settings (persisted, editable) ---------------- */
const ORG_KEY = 'trr_org_settings';
const DEFAULT_ORG = {
  name: 'The Rotten Republic',
  email: 'therottenrepublicofficial@gmail.com',
  phone: '+880 1886-071978',
  address: 'Dhaka, Bangladesh',
  logo: 'assets/img/logo.png'
};
function getOrg() {
  try { return { ...DEFAULT_ORG, ...JSON.parse(localStorage.getItem(ORG_KEY) || '{}') }; }
  catch (e) { return DEFAULT_ORG; }
}
function saveOrg(o) { localStorage.setItem(ORG_KEY, JSON.stringify(o)); }

/* ---------------- Invoice numbering ---------------- */
const COUNTER_KEY = 'trr_invoice_counter'; // { "2026": 3 }
function peekNextNumber() {
  const year = new Date().getFullYear();
  const counters = JSON.parse(localStorage.getItem(COUNTER_KEY) || '{}');
  const next = (counters[year] || 0) + 1;
  return `TRR-${year}-${String(next).padStart(3, '0')}`;
}
function consumeNextNumber() {
  const year = new Date().getFullYear();
  const counters = JSON.parse(localStorage.getItem(COUNTER_KEY) || '{}');
  counters[year] = (counters[year] || 0) + 1;
  localStorage.setItem(COUNTER_KEY, JSON.stringify(counters));
  return `TRR-${year}-${String(counters[year]).padStart(3, '0')}`;
}

/* ---------------- History log ---------------- */
const HISTORY_KEY = 'trr_invoice_history';
function getHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (e) { return []; } }
function pushHistory(entry) {
  const h = getHistory();
  h.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 50)));
  renderHistory();
}

/* ---------------- State ---------------- */
let items = [];
let numberLocked = false; // becomes true once first downloaded/printed
let currentNumber = '';

const DEFAULT_TERMS =
`Prize payouts are processed within 7–10 business days following the conclusion of the tournament and verification of player accounts.
Any discrepancies regarding this invoice must be reported within 48 hours of issuance.
Winnings are subject to forfeiture if rule violations or cheating are detected on the associated account(s).`;

document.addEventListener('DOMContentLoaded', () => {
  initOrgPanel();
  initRecipientToggle();
  initItems();
  initMeta();
  bindLivePreview();
  bindActions();
  renderHistory();
  renderPreview();
});

/* ---------------- Org settings panel ---------------- */
function initOrgPanel() {
  const org = getOrg();
  const f = document.getElementById('orgForm');
  f.elements.name.value = org.name;
  f.elements.email.value = org.email;
  f.elements.phone.value = org.phone;
  f.elements.address.value = org.address;
  f.elements.logo.value = org.logo;

  f.addEventListener('input', () => {
    saveOrg({
      name: f.elements.name.value,
      email: f.elements.email.value,
      phone: f.elements.phone.value,
      address: f.elements.address.value,
      logo: f.elements.logo.value
    });
    renderPreview();
  });

  document.getElementById('orgToggle').addEventListener('click', () => {
    document.getElementById('orgPanel').classList.toggle('open-panel');
  });
}

/* ---------------- Recipient type toggle ---------------- */
function initRecipientToggle() {
  const radios = document.querySelectorAll('input[name="billedType"]');
  radios.forEach(r => r.addEventListener('change', () => {
    document.querySelectorAll('.radio-opt').forEach(o => o.classList.remove('selected'));
    r.closest('.radio-opt').classList.add('selected');
    const isTeam = r.value === 'Team';
    document.getElementById('managerField').style.display = isTeam ? '' : 'none';
    document.getElementById('recipientLabel').textContent = isTeam ? 'Team name' : 'Player name (in-game / real)';
    renderPreview();
  }));
}

/* ---------------- Meta (number/date/due) ---------------- */
function initMeta() {
  currentNumber = peekNextNumber();
  document.getElementById('invNumber').value = currentNumber;
  document.getElementById('invNumber').addEventListener('input', e => {
    currentNumber = e.target.value;
    renderPreview();
  });

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('invDate').value = now.toISOString().slice(0, 16);
  document.getElementById('terms').value = DEFAULT_TERMS;
}

/* ---------------- Line items ---------------- */
function initItems() {
  addItemRow({ desc: 'Prize Pool Distribution — Honor of Kings Tournament', qty: 1, price: 0 });
  document.getElementById('addRow').addEventListener('click', () => addItemRow());
}

function addItemRow(data = { desc: '', qty: 1, price: 0 }) {
  const id = 'row_' + Math.random().toString(36).slice(2, 9);
  items.push({ id, ...data });
  renderItemRows();
}

function renderItemRows() {
  const tbody = document.getElementById('itemsBody');
  tbody.innerHTML = items.map(it => `
    <tr data-id="${it.id}">
      <td><input class="i-desc" value="${escapeAttr(it.desc)}" placeholder="Description / particulars"></td>
      <td style="width:70px;"><input class="i-qty" type="number" min="0" step="1" value="${it.qty}"></td>
      <td style="width:120px;"><input class="i-price" type="number" min="0" step="0.01" value="${it.price}"></td>
      <td style="width:44px;"><button type="button" class="row-remove" title="Remove row">×</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('tr').forEach(row => {
    const id = row.dataset.id;
    row.querySelector('.i-desc').addEventListener('input', e => updateItem(id, 'desc', e.target.value));
    row.querySelector('.i-qty').addEventListener('input', e => updateItem(id, 'qty', +e.target.value || 0));
    row.querySelector('.i-price').addEventListener('input', e => updateItem(id, 'price', +e.target.value || 0));
    row.querySelector('.row-remove').addEventListener('click', () => {
      items = items.filter(i => i.id !== id);
      if (!items.length) addItemRow();
      renderItemRows();
      renderPreview();
    });
  });
}
function updateItem(id, key, val) {
  const it = items.find(i => i.id === id);
  if (it) it[key] = val;
  renderPreview();
}

/* ---------------- Live preview binding ---------------- */
function bindLivePreview() {
  ['invNumber', 'invDate', 'dueDate', 'recipientName', 'managerName', 'recEmail', 'recPhone',
   'recDiscord', 'invoiceType', 'currency', 'payMethod', 'payDetails', 'terms']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', renderPreview);
    });
  document.getElementById('invoiceType').addEventListener('change', () => {
    const t = document.getElementById('invoiceType').value;
    const descField = items[0];
    if (descField && !descField._touched) {
      const presets = {
        'Prize Payout': 'Prize Pool Distribution — Honor of Kings Tournament',
        'Entry Fee': 'Tournament Entry Fee',
        'Purchase': 'Purchase — item / service',
        'Other': ''
      };
      descField.desc = presets[t] ?? descField.desc;
      renderItemRows();
    }
    renderPreview();
  });
}

function currencySymbol() {
  const c = document.getElementById('currency').value;
  return c === 'USD' ? '$' : '৳';
}

function fmtMoney(n) {
  return currencySymbol() + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDateNice(iso, withTime) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const opts = { day: '2-digit', month: 'short', year: 'numeric' };
  if (withTime) return d.toLocaleDateString('en-GB', opts) + ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-GB', opts);
}
function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }
function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

/* ---------------- Render the paper preview ---------------- */
function renderPreview() {
  const org = getOrg();
  const type = document.getElementById('invoiceType').value;
  const billedType = document.querySelector('input[name="billedType"]:checked').value;
  const recipientName = document.getElementById('recipientName').value || '—';
  const managerName = document.getElementById('managerName').value;
  const recEmail = document.getElementById('recEmail').value;
  const recPhone = document.getElementById('recPhone').value;
  const recDiscord = document.getElementById('recDiscord').value;
  const invDate = document.getElementById('invDate').value;
  const dueDate = document.getElementById('dueDate').value;
  const payMethod = document.getElementById('payMethod').value;
  const payDetails = document.getElementById('payDetails').value;
  const terms = document.getElementById('terms').value;

  const grandTotal = items.reduce((s, it) => s + (it.qty * it.price), 0);

  document.getElementById('previewNumber').textContent = document.getElementById('invNumber').value || currentNumber;
  document.getElementById('previewType').textContent = type;
  document.getElementById('previewDate').textContent = fmtDateNice(invDate, true);
  document.getElementById('previewDue').closest('.meta-line').style.display = dueDate ? '' : 'none';
  document.getElementById('previewDue').textContent = fmtDateNice(dueDate, false);

  document.getElementById('previewOrgName').textContent = org.name;
  document.getElementById('previewOrgContact').innerHTML = `${escapeHTML(org.email)}<br>${escapeHTML(org.phone)}<br>${escapeHTML(org.address)}`;
  document.getElementById('previewLogo').src = org.logo;

  document.getElementById('previewBilledLabel').textContent = billedType === 'Team' ? 'Team' : 'Player';
  document.getElementById('previewRecipient').textContent = recipientName;
  const mgrLine = document.getElementById('previewManagerLine');
  if (billedType === 'Team' && managerName) {
    mgrLine.style.display = '';
    document.getElementById('previewManager').textContent = managerName;
  } else mgrLine.style.display = 'none';

  const contactBits = [recEmail, recPhone, recDiscord ? 'Discord: ' + recDiscord : ''].filter(Boolean);
  document.getElementById('previewRecContact').innerHTML = contactBits.join('<br>') || '—';

  document.getElementById('itemsPreviewBody').innerHTML = items.map(it => `
    <tr>
      <td>${escapeHTML(it.desc) || '—'}</td>
      <td style="text-align:center;">${it.qty}</td>
      <td style="text-align:right;">${fmtMoney(it.price)}</td>
      <td style="text-align:right;">${fmtMoney(it.qty * it.price)}</td>
    </tr>
  `).join('');
  document.getElementById('previewTotal').textContent = fmtMoney(grandTotal);

  const payLine = document.getElementById('previewPayment');
  payLine.closest('.pay-block').style.display = (payMethod || payDetails) ? '' : 'none';
  payLine.innerHTML = `${escapeHTML(payMethod)}${payDetails ? ' — ' + escapeHTML(payDetails) : ''}`;

  document.getElementById('previewTerms').innerHTML = terms.split('\n').filter(Boolean).map(t => `<li>${escapeHTML(t)}</li>`).join('');
}

/* ---------------- Actions: new / download / print ---------------- */
function bindActions() {
  document.getElementById('newInvoiceBtn').addEventListener('click', newInvoice);
  document.getElementById('downloadPdfBtn').addEventListener('click', () => finalizeAnd(downloadPDF));
  document.getElementById('downloadJpgBtn').addEventListener('click', () => finalizeAnd(downloadJPG));
  document.getElementById('printBtn').addEventListener('click', () => finalizeAnd(() => window.print()));
  document.getElementById('clearHistory').addEventListener('click', () => {
    if (confirm('Clear invoice history? (This only clears the local log, not the numbering counter.)')) {
      localStorage.setItem(HISTORY_KEY, '[]');
      renderHistory();
    }
  });
}

function newInvoice() {
  numberLocked = false;
  currentNumber = peekNextNumber();
  document.getElementById('invNumber').value = currentNumber;
  document.getElementById('recipientForm').reset();
  document.querySelectorAll('.radio-opt').forEach((o, i) => o.classList.toggle('selected', i === 0));
  document.getElementById('managerField').style.display = 'none';
  document.getElementById('recipientLabel').textContent = 'Player name (in-game / real)';
  items = [];
  addItemRow();
  initMeta();
  renderItemRows();
  renderPreview();
  trrToast('New invoice started — number ' + currentNumber + ' reserved.');
}

function finalizeAnd(action) {
  if (!numberLocked) {
    const assigned = consumeNextNumber();
    document.getElementById('invNumber').value = assigned;
    currentNumber = assigned;
    numberLocked = true;
    renderPreview();
    logInvoice();
  }
  // slight delay so DOM reflects the finalized number before capture
  setTimeout(action, 30);
}

function logInvoice() {
  const grandTotal = items.reduce((s, it) => s + (it.qty * it.price), 0);
  pushHistory({
    number: document.getElementById('invNumber').value,
    type: document.getElementById('invoiceType').value,
    recipient: document.getElementById('recipientName').value || '—',
    total: fmtMoney(grandTotal),
    date: new Date().toISOString()
  });
}

function renderHistory() {
  const wrap = document.getElementById('historyList');
  const h = getHistory();
  if (!h.length) {
    wrap.innerHTML = `<p class="hint">No finalized invoices yet — your history log will build up here.</p>`;
    return;
  }
  wrap.innerHTML = h.map(e => `
    <div style="display:flex; justify-content:space-between; gap:10px; padding:10px 0; border-bottom:1px solid var(--line); font-size:13px;">
      <div><b class="mono" style="color:#fff;">${e.number}</b><br><span class="hint">${e.type} · ${e.recipient}</span></div>
      <div style="text-align:right;"><b style="color:#fff;">${e.total}</b><br><span class="hint">${fmtDateNice(e.date, false)}</span></div>
    </div>
  `).join('');
}

/* ---------------- Export as PDF / JPG ---------------- */
function downloadJPG() {
  const node = document.getElementById('invoicePaper');
  trrToast('Rendering JPG…');
  html2canvas(node, { scale: 2, backgroundColor: '#f4f1e9', useCORS: true }).then(canvas => {
    const link = document.createElement('a');
    link.download = `${document.getElementById('invNumber').value || 'invoice'}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
  }).catch(() => trrToast('Could not render JPG — try again.'));
}

function downloadPDF() {
  const node = document.getElementById('invoicePaper');
  trrToast('Rendering PDF…');
  html2canvas(node, { scale: 2, backgroundColor: '#f4f1e9', useCORS: true }).then(canvas => {
    const { jsPDF } = window.jspdf;
    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
    const w = canvas.width * ratio, h = canvas.height * ratio;
    pdf.addImage(imgData, 'JPEG', (pageW - w) / 2, 24, w, h);
    pdf.save(`${document.getElementById('invNumber').value || 'invoice'}.pdf`);
  }).catch(() => trrToast('Could not render PDF — try again.'));
}