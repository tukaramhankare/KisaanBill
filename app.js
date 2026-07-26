/* ═══════════════════════════════════════════════════════════════
   KisaanBill v5 — app.js
   4 Themes: Light | Gray | Premium Gray | Dark
   All exports use local bundled engines (KBPdf, KBExcel, KBDocx)
   Presets: full save/restore via localStorage
   ═══════════════════════════════════════════════════════════════ */
'use strict';

var LS_THEME   = 'kb5_theme';
var LS_PRESETS = 'kb5_presets';
var lineItems  = [];
var lineIdSeed = 0;

/* ══════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {
  initTheme();
  initNav();
  initSidebar();
  initModals();
  renderQuickBar();
  renderPresetList();
  recalculate();
});

/* ══════════════════════════════════════════════════════
   THEME
══════════════════════════════════════════════════════ */
function initTheme() {
  applyTheme(localStorage.getItem(LS_THEME) || 'light', false);
}

function applyTheme(theme, save) {
  document.documentElement.setAttribute('data-theme', theme);
  if (save !== false) localStorage.setItem(LS_THEME, theme);

  var mc = { light:'#1c1917', gray:'#18181b', 'premium-gray':'#101014', dark:'#0a0a0a' };
  var m  = document.getElementById('metaTheme');
  if (m) m.content = mc[theme] || '#1c1917';

  document.querySelectorAll('.tp-btn, .stb').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-theme') === theme);
  });
}

/* ══════════════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════════════ */
function initNav() {
  document.querySelectorAll('.tnav, .snav').forEach(function (b) {
    b.addEventListener('click', function () {
      switchTab(b.getAttribute('data-tab'));
      closeSidebar();
    });
  });
  document.querySelectorAll('.tp-btn, .stb').forEach(function (b) {
    b.addEventListener('click', function () {
      applyTheme(b.getAttribute('data-theme'));
      showToast('Theme: ' + b.getAttribute('data-theme'));
    });
  });
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
  var p = g('tab-' + tab);
  if (p) p.classList.add('active');

  document.querySelectorAll('.tnav, .snav').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-tab') === tab);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (tab === 'preview') renderPreview();
  if (tab === 'presets') renderPresetList();
}

/* ══════════════════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════════════════ */
function initSidebar() {
  var mb = g('menuBtn'), sb = g('sidebar'), ov = g('sbOverlay'), cl = g('sbClose');
  function open() { sb.classList.add('open'); ov.classList.add('open'); document.body.style.overflow = 'hidden'; }
  if (mb) mb.addEventListener('click', open);
  if (cl) cl.addEventListener('click', closeSidebar);
  if (ov) ov.addEventListener('click', closeSidebar);
}
function closeSidebar() {
  var sb = g('sidebar'), ov = g('sbOverlay');
  if (sb) sb.classList.remove('open');
  if (ov) ov.classList.remove('open');
  document.body.style.overflow = '';
}

/* ══════════════════════════════════════════════════════
   MODALS
══════════════════════════════════════════════════════ */
function initModals() {
  function wire(openId, bgId, modalId, closeId) {
    var ob = g(openId), bg = g(bgId), mo = g(modalId), cl = g(closeId);
    function open() { if (bg) bg.classList.add('open'); if (mo) mo.classList.add('open'); document.body.style.overflow = 'hidden'; }
    function close() { if (bg) bg.classList.remove('open'); if (mo) mo.classList.remove('open'); document.body.style.overflow = ''; }
    if (ob) ob.addEventListener('click', open);
    if (cl) cl.addEventListener('click', close);
    if (bg) bg.addEventListener('click', close);
  }
  wire('aboutBtn', 'aboutBg', 'aboutModal', 'aboutClose');

  var pb = g('presetBg'), pc = g('presetClose');
  if (pb) pb.addEventListener('click', closePresetModal);
  if (pc) pc.addEventListener('click', closePresetModal);
}

function openPresetModal() {
  var nm = g('presetNameModal');
  if (nm) nm.value = '';
  g('presetBg').classList.add('open');
  g('presetModal').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(function () { var e = g('presetNameModal'); if (e) e.focus(); }, 80);
}
function closePresetModal() {
  g('presetBg').classList.remove('open');
  g('presetModal').classList.remove('open');
  document.body.style.overflow = '';
}

/* ══════════════════════════════════════════════════════
   RATE BASIS
══════════════════════════════════════════════════════ */
function onRateBasisChange() {
  var basis = gv('rateBasis');
  var row   = g('rateRow');
  if (!basis) { row.classList.add('hidden'); recalculate(); return; }
  row.classList.remove('hidden');
  var M = { hour:['Total Hours Worked','Rate per Hour (₹)'], acre:['Total Acres','Rate per Acre (₹)'], day:['Number of Days','Rate per Day (₹)'], trip:['Number of Trips','Rate per Trip (₹)'] };
  var p = M[basis] || ['Quantity','Rate (₹)'];
  var ql = g('wQtyLbl'), rl = g('wRateLbl');
  if (ql) ql.textContent = p[0];
  if (rl) rl.textContent = p[1];
  recalculate();
}

/* ══════════════════════════════════════════════════════
   LINE ITEMS
══════════════════════════════════════════════════════ */
function addLineItem() {
  lineIdSeed++;
  var id = lineIdSeed;
  lineItems.push({ id:id, desc:'', unit:'Job', qty:0, rate:0, amount:0 });
  var tbody = g('lineBody');
  var tr = document.createElement('tr');
  tr.id = 'lr-' + id;
  tr.innerHTML =
    '<td class="cn"><span class="ln">' + lineItems.length + '</span></td>' +
    '<td><input type="text" placeholder="Description" autocomplete="off" oninput="updateLF(' + id + ',\'desc\',this.value)"/></td>' +
    '<td><select onchange="updateLF(' + id + ',\'unit\',this.value)">' +
      '<option>Job</option><option>Hour</option><option>Acre</option><option>Day</option>' +
      '<option>Trip</option><option>Piece</option><option>Litre</option><option>Kg</option>' +
    '</select></td>' +
    '<td><input type="number" placeholder="0" min="0" step="0.5" style="width:52px" inputmode="decimal" oninput="updateLF(' + id + ',\'qty\',this.value)"/></td>' +
    '<td><input type="number" placeholder="0" min="0" style="width:74px" inputmode="decimal" oninput="updateLF(' + id + ',\'rate\',this.value)"/></td>' +
    '<td class="ca" id="la-' + id + '">₹0.00</td>' +
    '<td><button class="btn-del" type="button" onclick="removeLI(' + id + ')">✕</button></td>';
  tbody.appendChild(tr);
  recalculate();
}

function updateLF(id, field, raw) {
  var item = lineItems.find(function (i) { return i.id === id; });
  if (!item) return;
  if (field === 'qty' || field === 'rate') item[field] = parseFloat(raw) || 0;
  else item[field] = raw;
  item.amount = r2(item.qty * item.rate);
  st('la-' + id, '₹' + fmtN(item.amount));
  recalculate();
}

function removeLI(id) {
  lineItems = lineItems.filter(function (i) { return i.id !== id; });
  var row = g('lr-' + id);
  if (row) row.parentNode.removeChild(row);
  document.querySelectorAll('#lineBody tr').forEach(function (r, i) {
    var n = r.querySelector('.ln'); if (n) n.textContent = i + 1;
  });
  recalculate();
}

/* ══════════════════════════════════════════════════════
   CALCULATIONS
══════════════════════════════════════════════════════ */
function compute() {
  var wq = parseFloat((g('workQty')  || {}).value) || 0;
  var wr = parseFloat((g('workRate') || {}).value) || 0;
  var svc = r2(wq * wr);
  var lines = r2(lineItems.reduce(function (s, i) { return s + i.amount; }, 0));
  var fuel  = parseFloat(g('fuelCost').value)     || 0;
  var wage  = parseFloat(g('operatorWage').value) || 0;
  var trav  = parseFloat(g('travelCharge').value) || 0;
  var othr  = parseFloat(g('otherCharge').value)  || 0;
  var extra = r2(fuel + wage + trav + othr);
  var sub   = r2(svc + lines + extra);
  var dPct  = Math.min(Math.max(parseFloat(g('discountPct').value) || 0, 0), 100);
  var dAmt  = r2(sub * dPct / 100);
  var afterD = r2(sub - dAmt);
  var gPct  = parseFloat(g('gstRate').value) || 0;
  var gAmt  = r2(afterD * gPct / 100);
  var grand = r2(afterD + gAmt);
  var adv   = parseFloat(g('advancePaid').value) || 0;
  var bal   = r2(grand - adv);
  return { svc:svc, lines:lines, fuel:fuel, wage:wage, trav:trav, othr:othr,
           extra:extra, sub:sub, dPct:dPct, dAmt:dAmt, afterD:afterD,
           gPct:gPct, gAmt:gAmt, grand:grand, adv:adv, bal:bal };
}

function recalculate() {
  var c = compute();
  st('t-svc',   fmtINR(c.svc));
  st('t-lines', fmtINR(c.lines));
  st('t-extra', fmtINR(c.extra));
  st('t-sub',   fmtINR(c.sub));
  st('t-grand', fmtINR(c.grand));
  st('t-bal',   fmtINR(c.bal));
  var dr = g('discRow'), dl = g('discLbl'), dtd = g('t-disc');
  if (c.dAmt > 0) { dr.classList.remove('hidden'); if (dl) dl.textContent = 'Discount (' + c.dPct + '%)'; if (dtd) dtd.textContent = '— ' + fmtINR(c.dAmt); } else dr.classList.add('hidden');
  var gr = g('gstRow'), gl = g('gstLbl'), tg = g('t-gst');
  if (c.gAmt > 0) { gr.classList.remove('hidden'); if (gl) gl.textContent = 'GST (' + c.gPct + '%)'; if (tg) tg.textContent = fmtINR(c.gAmt); } else gr.classList.add('hidden');
  var ar = g('advRow'), ta = g('t-adv');
  if (c.adv > 0) { ar.classList.remove('hidden'); if (ta) ta.textContent = '— ' + fmtINR(c.adv); } else ar.classList.add('hidden');
}

/* ══════════════════════════════════════════════════════
   RESET
══════════════════════════════════════════════════════ */
function resetAll() {
  if (!confirm('Reset all fields? Cannot be undone.')) return;
  document.querySelectorAll('#tab-builder input, #tab-builder select, #tab-builder textarea').forEach(function (el) {
    el.tagName === 'SELECT' ? (el.selectedIndex = 0) : (el.value = '');
  });
  g('rateRow').classList.add('hidden');
  lineItems = []; lineIdSeed = 0;
  g('lineBody').innerHTML = '';
  recalculate();
  g('invoicePaper').innerHTML = '<p class="empty-msg">Complete the Builder and click "Preview Invoice".</p>';
  showToast('Form reset.');
}

/* ══════════════════════════════════════════════════════
   PRESETS
══════════════════════════════════════════════════════ */
var PF = ['ownerName','ownerPhone','ownerAddress','ownerGST','ownerBank','tractorModel','tractorReg','tractorHP','operatorName','fuelCost','operatorWage','travelCharge','otherCharge','discountPct','workQty','workRate','remarks'];
var PS = ['implement','fuelType','rateBasis','gstRate','payMode'];

function buildPreset(name) {
  var p = { id:Date.now(), name:name, savedAt:new Date().toISOString() };
  PF.forEach(function (f) { var el = g(f); p[f] = el ? el.value : ''; });
  PS.forEach(function (f) { var el = g(f); p[f] = el ? el.value : ''; });
  return p;
}

function savePresetDirect() {
  var ne = g('presetNameField');
  var name = ne ? ne.value.trim() : '';
  if (!name) { showToast('Enter a preset name.'); if (ne) ne.focus(); return; }
  doSave(name);
  if (ne) ne.value = '';
}

function confirmSavePreset() {
  var ne = g('presetNameModal');
  var name = ne ? ne.value.trim() : '';
  if (!name) { showToast('Enter a preset name.'); if (ne) ne.focus(); return; }
  doSave(name);
  closePresetModal();
}

function doSave(name) {
  var list = loadPresets();
  list.push(buildPreset(name));
  localStorage.setItem(LS_PRESETS, JSON.stringify(list));
  renderPresetList();
  renderQuickBar();
  showToast('Preset "' + name + '" saved!');
}

function loadPresets() {
  try { return JSON.parse(localStorage.getItem(LS_PRESETS) || '[]'); } catch (e) { return []; }
}

function applyPreset(id) {
  var list = loadPresets();
  var p = list.find(function (x) { return x.id === id; });
  if (!p) { showToast('Preset not found.'); return; }

  PF.forEach(function (f) {
    var el = g(f);
    if (!el) return;
    el.value = (p[f] !== undefined && p[f] !== null) ? p[f] : '';
  });

  PS.forEach(function (f) {
    var el = g(f);
    if (!el) return;
    var val = String(p[f] !== undefined && p[f] !== null ? p[f] : '');
    el.selectedIndex = 0;
    for (var i = 0; i < el.options.length; i++) {
      if (el.options[i].value === val || el.options[i].text === val) {
        el.selectedIndex = i; break;
      }
    }
  });

  onRateBasisChange();
  closeSidebar();
  switchTab('builder');
  showToast('Preset "' + p.name + '" applied!');
}

function deletePreset(id) {
  var list = loadPresets();
  var p = list.find(function (x) { return x.id === id; });
  if (!p || !confirm('Delete "' + p.name + '"?')) return;
  localStorage.setItem(LS_PRESETS, JSON.stringify(list.filter(function (x) { return x.id !== id; })));
  renderPresetList(); renderQuickBar();
  showToast('Preset deleted.');
}

function renderPresetList() {
  var el = g('presetListEl');
  if (!el) return;
  var list = loadPresets();
  if (!list.length) { el.innerHTML = '<p class="empty-msg">No presets yet.</p>'; return; }
  el.innerHTML = list.map(function (p) {
    var meta = [p.tractorModel, p.ownerName, p.rateBasis ? p.rateBasis + ' basis' : ''].filter(Boolean).join(' · ');
    var dt = ''; try { dt = new Date(p.savedAt).toLocaleDateString('en-IN'); } catch(e) {}
    return '<div class="preset-item">' +
      '<div class="pi-ico">🚜</div>' +
      '<div class="pi-info"><div class="pi-name">' + esc(p.name) + '</div>' +
      '<div class="pi-meta">' + esc(meta) + (dt ? ' · ' + dt : '') + '</div></div>' +
      '<div class="pi-acts">' +
        '<button class="pi-apply" type="button" onclick="applyPreset(' + p.id + ')">⚡ Apply</button>' +
        '<button class="pi-del"   type="button" onclick="deletePreset(' + p.id + ')">🗑</button>' +
      '</div></div>';
  }).join('');
}

function renderQuickBar() {
  var bar = g('quickBar'), pills = g('qbPills');
  if (!bar || !pills) return;
  var list = loadPresets();
  if (!list.length) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  pills.innerHTML = list.map(function (p) {
    return '<button class="qb-pill" type="button" onclick="applyPreset(' + p.id + ')">' + esc(p.name) + '</button>';
  }).join('');
}

/* ══════════════════════════════════════════════════════
   COLLECT DATA
══════════════════════════════════════════════════════ */
function getData() {
  var c    = compute();
  var basis = gv('rateBasis');
  var bLbl  = { hour:'Hour(s)', acre:'Acre(s)', day:'Day(s)', trip:'Trip(s)' }[basis] || 'Unit';
  return {
    invoiceNo: gv('invoiceNo'),   invoiceDate: gv('invoiceDate'),
    dueDate:   gv('dueDate'),     ownerName:   gv('ownerName'),
    ownerPhone:gv('ownerPhone'),  ownerAddress:gv('ownerAddress'),
    ownerGST:  gv('ownerGST'),    ownerBank:   gv('ownerBank'),
    farmerName:gv('farmerName'),  farmerPhone: gv('farmerPhone'),
    farmerAddress:gv('farmerAddress'),
    tractorModel:gv('tractorModel'), tractorReg:gv('tractorReg'),
    tractorHP: gv('tractorHP'),   implement:   gv('implement'),
    operatorName:gv('operatorName'), fuelType:  gv('fuelType'),
    workStart: gv('workStart'),   workEnd:     gv('workEnd'),
    cropType:  gv('cropType'),    landArea:    gv('landArea'),
    areaUnit:  gv('areaUnit'),    rateBasis:   basis,
    bLbl:      bLbl,
    workQty:   parseFloat(gv('workQty'))  || 0,
    workRate:  parseFloat(gv('workRate')) || 0,
    payMode:   gv('payMode'),     remarks:     gv('remarks'),
    lineItems: lineItems.filter(function (i) { return i.desc.trim(); }),
    c:         c,
    inWords:   amountInWords(c.grand),
    genAt:     new Date().toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' })
  };
}

/* ══════════════════════════════════════════════════════
   PREVIEW
══════════════════════════════════════════════════════ */
function goPreview() { switchTab('preview'); }

function renderPreview() {
  var d = getData(), c = d.c, rn = 1, el = g('invoicePaper');
  var rows = '';
  if (c.svc > 0) rows += '<tr><td>' + (rn++) + '</td><td>Tractor Rental' + (d.rateBasis ? ' – ' + d.rateBasis + ' basis' : '') + (d.tractorModel ? ' (' + esc(d.tractorModel) + ')' : '') + '</td><td>' + esc(d.bLbl) + '</td><td style="text-align:center">' + d.workQty + '</td><td style="text-align:right">' + fmtINR(d.workRate) + '</td><td>' + fmtINR(c.svc) + '</td></tr>';
  d.lineItems.forEach(function (item) { rows += '<tr><td>' + (rn++) + '</td><td>' + esc(item.desc) + '</td><td>' + esc(item.unit) + '</td><td style="text-align:center">' + item.qty + '</td><td style="text-align:right">' + fmtINR(item.rate) + '</td><td>' + fmtINR(item.amount) + '</td></tr>'; });
  [['Diesel / Fuel Cost',c.fuel],['Operator Wage',c.wage],['Transport / Travel',c.trav],['Other Charges',c.othr]].forEach(function (ch) {
    if (ch[1] > 0) rows += '<tr><td>' + (rn++) + '</td><td>' + ch[0] + '</td><td>—</td><td style="text-align:center">1</td><td style="text-align:right">' + fmtINR(ch[1]) + '</td><td>' + fmtINR(ch[1]) + '</td></tr>';
  });
  if (!rows) rows = '<tr><td colspan="6" style="text-align:center;color:#999;padding:13px">No items added.</td></tr>';

  var tots = '<tr><td class="lbl">Subtotal</td><td class="val">' + fmtINR(c.sub) + '</td></tr>';
  if (c.dAmt > 0) tots += '<tr><td class="lbl">Discount (' + c.dPct + '%)</td><td class="val dv">— ' + fmtINR(c.dAmt) + '</td></tr>';
  if (c.gAmt > 0) tots += '<tr><td class="lbl">GST (' + c.gPct + '%)</td><td class="val">' + fmtINR(c.gAmt) + '</td></tr>';
  tots += '<tr><td class="gl">Grand Total</td><td class="gv">' + fmtINR(c.grand) + '</td></tr>';
  if (c.adv > 0) tots += '<tr><td class="lbl">Advance Paid</td><td class="val dv">— ' + fmtINR(c.adv) + '</td></tr>';
  tots += '<tr><td class="bl">Balance Due</td><td class="bv">' + fmtINR(c.bal) + '</td></tr>';

  var tfArr = [['Model',d.tractorModel],['Reg.',d.tractorReg],['HP',d.tractorHP?d.tractorHP+' HP':''],['Implement',d.implement],['Fuel',d.fuelType],['Operator',d.operatorName],['Crop',d.cropType],['Area',d.landArea&&d.areaUnit?d.landArea+' '+d.areaUnit:''],['Period',d.workStart&&d.workEnd?fmtDate(d.workStart)+'→'+fmtDate(d.workEnd):'']].filter(function(f){return f[1];});
  var tfHTML = tfArr.map(function(f){return '<div class="inv-tf"><span class="inv-tf-l">'+f[0]+'</span><span class="inv-tf-v">'+esc(f[1])+'</span></div>';}).join('');

  el.innerHTML =
    '<div class="inv-top">' +
      '<div><div class="inv-bn">🚜 '+esc(d.ownerName||'Service Provider')+'</div>' +
      '<div class="inv-bs">Tractor Rent Services</div>' +
      '<div class="inv-bc">'+(d.ownerPhone?'📞 '+esc(d.ownerPhone)+'<br>':'')+(d.ownerAddress?esc(d.ownerAddress)+'<br>':'')+(d.ownerGST?'GST: '+esc(d.ownerGST)+'<br>':'')+(d.ownerBank?'💳 '+esc(d.ownerBank):'')+
      '</div></div>' +
      '<div class="inv-meta-block"><div class="inv-title">INVOICE</div>' +
      '<div class="inv-meta"><b>No:</b> '+esc(d.invoiceNo||'—')+'<br><b>Date:</b> '+(d.invoiceDate?fmtDate(d.invoiceDate):'—')+'<br>'+(d.dueDate?'<b>Due:</b> '+fmtDate(d.dueDate)+'<br>':'')+(d.payMode?'<b>Payment:</b> '+esc(d.payMode):'')+
      '</div></div></div>' +
      '<div class="inv-parties"><div class="inv-party"><div class="inv-party-lbl">Billed To (Farmer)</div><div class="inv-party-name">'+esc(d.farmerName||'—')+'</div><div class="inv-party-info">'+(d.farmerPhone?'📞 '+esc(d.farmerPhone)+'<br>':'')+esc(d.farmerAddress)+'</div></div>' +
      '<div class="inv-party"><div class="inv-party-lbl">Service Provider</div><div class="inv-party-name">'+esc(d.ownerName||'—')+'</div><div class="inv-party-info">'+(d.ownerPhone?'📞 '+esc(d.ownerPhone)+'<br>':'')+esc(d.ownerAddress)+'</div></div></div>' +
      (tfHTML?'<div class="inv-tractor"><div class="inv-tractor-lbl">🚜 Tractor &amp; Work Details</div><div class="inv-tractor-fields">'+tfHTML+'</div></div>':'') +
      '<div class="inv-tbl-wrap"><table class="inv-tbl"><thead><tr><th style="width:26px">#</th><th>Description</th><th style="width:55px">Unit</th><th style="width:42px;text-align:center">Qty</th><th style="width:82px;text-align:right">Rate</th><th style="width:92px">Amount</th></tr></thead><tbody>'+rows+'</tbody></table></div>' +
      '<div class="inv-tots-wrap"><table class="inv-tots-tbl">'+tots+'</table></div>' +
      '<div class="inv-words"><strong>Amount in Words</strong>'+esc(d.inWords)+'</div>' +
      (d.remarks?'<div class="inv-remarks"><strong>📝 Remarks</strong>'+esc(d.remarks)+'</div>':'') +
      '<div class="inv-sigs"><div class="inv-sig">Farmer\'s Signature</div><div class="inv-sig" style="text-align:right">Authorised Signatory</div></div>' +
      '<div class="inv-footer">Computer-generated by KisaanBill · '+d.genAt+'</div>';
}

/* ══════════════════════════════════════════════════════
   VALIDATION
══════════════════════════════════════════════════════ */
function requireFields() {
  var miss = [];
  if (!gv('invoiceNo'))   miss.push('Invoice Number');
  if (!gv('invoiceDate')) miss.push('Invoice Date');
  if (!gv('ownerName'))   miss.push('Owner / Provider Name');
  if (!gv('farmerName'))  miss.push('Farmer Name');
  if (miss.length) { alert('Please fill required fields:\n• ' + miss.join('\n• ')); switchTab('builder'); return false; }
  return true;
}

/* ══════════════════════════════════════════════════════
   EXPORT — PDF  (uses KBPdf engine)
══════════════════════════════════════════════════════ */
function exportPDF() {
  if (!requireFields()) return;
  if (typeof KBPdf === 'undefined') { alert('PDF engine not loaded. Please refresh the page.'); return; }

  showLoader('Generating PDF…');
  setTimeout(function () {
    try {
      var d  = getData(), c = d.c;
      var doc = new KBPdf();
      var pg  = doc.addPage(595, 842);

      /* colours as fractions */
      var G = [0.11,0.22,0.11];    /* dark green */
      var AM = [0.85,0.47,0.03];   /* amber */
      var LG = [0.94,0.97,0.92];   /* light green */
      var W  = [1,1,1];
      var T  = [0.42,0.50,0.40];   /* text muted */
      var DT = [0.10,0.15,0.10];   /* dark text */
      var AM2= [1,0.98,0.88];      /* light amber */
      var AM3= [0.77,0.48,0.05];   /* amber text */

      var PW = 595, M = 36;

      /* ── Header band ── */
      pg.setFill.apply(pg, G); pg.fillRect(0, 0, PW, 48);
      pg.setFill(0.85,0.47,0.03); pg.fillRect(0, 0, 5, 48);
      pg.setFill.apply(pg, [0.92,0.68,0.25]); pg.setFont(true, 17);
      pg.drawText('KisaanBill', M + 5, 16);
      pg.setFill(0.63,0.78,0.55); pg.setFont(false, 7.5);
      pg.drawText('TRACTOR RENT INVOICE SYSTEM', M + 5, 27);
      if (d.ownerName) { pg.setFill(1,1,1); pg.setFont(true, 9.5); pg.drawText(d.ownerName.substring(0,42), M + 5, 38); }

      pg.setFill.apply(pg, [0.92,0.68,0.25]); pg.setFont(true, 20);
      pg.drawText('INVOICE', PW - M, 20, 'right');
      pg.setFill(0.77,0.85,0.68); pg.setFont(false, 7.5);
      var ml = []; if (d.invoiceNo) ml.push('No: ' + d.invoiceNo); if (d.invoiceDate) ml.push('Date: ' + fmtDate(d.invoiceDate)); if (d.dueDate) ml.push('Due: ' + fmtDate(d.dueDate)); if (d.payMode) ml.push('Pay: ' + d.payMode);
      ml.forEach(function (l, i) { pg.drawText(l, PW - M, 30 + i * 7, 'right'); });

      var y = 62;

      /* ── Party boxes ── */
      var bW = Math.floor((PW - 2 * M - 8) / 2);
      pg.setFill.apply(pg, LG); pg.fillRect(M, y, bW, 34); pg.fillRect(M + bW + 8, y, bW, 34);

      function pBox(x, lbl, name, phone, addr) {
        pg.setFill(0.18,0.38,0.18); pg.setFont(true, 6.5); pg.drawText(lbl, x + 4, y + 10);
        pg.setFill.apply(pg, DT); pg.setFont(true, 9.5); pg.drawText((name||'—').substring(0,30), x + 4, y + 20);
        pg.setFill.apply(pg, T); pg.setFont(false, 7.5);
        if (phone) pg.drawText('Tel: ' + phone, x + 4, y + 27);
        if (addr)  pg.drawText(addr.substring(0,36), x + 4, y + 33);
      }
      pBox(M, 'BILLED TO (FARMER)', d.farmerName, d.farmerPhone, d.farmerAddress);
      pBox(M + bW + 8, 'SERVICE PROVIDER', d.ownerName, d.ownerPhone, d.ownerAddress);
      y += 42;

      /* ── Tractor band ── */
      var tfP = [['Model',d.tractorModel],['Reg.',d.tractorReg],['HP',d.tractorHP?d.tractorHP+' HP':''],['Implement',d.implement],['Fuel',d.fuelType],['Operator',d.operatorName],['Crop',d.cropType],['Area',d.landArea&&d.areaUnit?d.landArea+' '+d.areaUnit:''],['Period',d.workStart&&d.workEnd?fmtDate(d.workStart)+'–'+fmtDate(d.workEnd):'']].filter(function(p){return p[1];});
      if (tfP.length) {
        var tfH = Math.ceil(tfP.length / 4) * 18 + 14;
        pg.setFill(1,0.98,0.88); pg.fillRect(M, y, PW - 2*M, tfH);
        pg.setFill(0.77,0.56,0.08); pg.setFont(true, 6.5); pg.drawText('TRACTOR & WORK DETAILS', M + 4, y + 9);
        var cW2 = Math.floor((PW - 2*M) / 4);
        tfP.forEach(function (p, i) {
          var col2 = i % 4, row2 = Math.floor(i / 4);
          var fx = M + col2 * cW2 + 4, fy = y + 16 + row2 * 18;
          pg.setFill(0.6,0.42,0.08); pg.setFont(false, 7); pg.drawText(p[0] + ':', fx, fy);
          pg.setFill(0.36,0.27,0.08); pg.setFont(true, 8); pg.drawText(String(p[1]).substring(0,18), fx + 28, fy);
        });
        y += tfH + 7;
      }

      /* ── Line items table ── */
      var cX = [M, M+26, M+192, M+252, M+304, M+376];
      /* header */
      pg.setFill.apply(pg, G); pg.fillRect(M, y, PW - 2*M, 19);
      ['#','Description','Unit','Qty','Rate','Amount'].forEach(function (h, i) {
        pg.setFill.apply(pg, W); pg.setFont(true, 7.5); pg.drawText(h, cX[i] + 3, y + 13);
      });
      y += 19;

      var allRows = [];
      var rn2 = 1;
      if (c.svc > 0) allRows.push([rn2++, 'Tractor Rental ('+d.rateBasis+')' + (d.tractorModel?' – '+d.tractorModel.substring(0,20):''), d.bLbl, String(d.workQty), fmtINR(d.workRate), fmtINR(c.svc)]);
      d.lineItems.forEach(function (item) { allRows.push([rn2++, item.desc.substring(0,38), item.unit, String(item.qty), fmtINR(item.rate), fmtINR(item.amount)]); });
      [['Diesel/Fuel',c.fuel],['Operator Wage',c.wage],['Travel',c.trav],['Other',c.othr]].forEach(function (ch) { if (ch[1]>0) allRows.push([rn2++, ch[0], '—', '1', fmtINR(ch[1]), fmtINR(ch[1])]); });

      if (!allRows.length) allRows.push(['—','No service items added','','','','']);

      allRows.forEach(function (row, ri) {
        var rh = 17;
        if (ri % 2 === 1) { pg.setFill.apply(pg, LG); pg.fillRect(M, y, PW - 2*M, rh); }
        row.forEach(function (cell, ci) {
          pg.setFill.apply(pg, DT); pg.setFont(ci===5, 8); pg.drawText(String(cell), cX[ci] + 3, y + 12);
        });
        pg.setStroke(0.85,0.90,0.80); pg.setLineWidth(0.4); pg.hLine(M, PW-M, y+rh);
        y += rh;
      });

      y += 7;

      /* ── Totals ── */
      var tX = PW - M - 152, tW3 = 152;
      var tRows2 = [['Subtotal', fmtINR(c.sub)]];
      if (c.dAmt > 0) tRows2.push(['Discount ('+c.dPct+'%)', '– '+fmtINR(c.dAmt)]);
      if (c.gAmt > 0) tRows2.push(['GST ('+c.gPct+'%)', fmtINR(c.gAmt)]);
      var tInH = tRows2.length * 15 + 3;
      pg.setFill(0.95,0.97,0.94); pg.fillRect(tX, y, tW3, tInH);
      tRows2.forEach(function (r, i) {
        var ty2 = y + 11 + i * 15;
        pg.setFill.apply(pg, T); pg.setFont(false, 8); pg.drawText(r[0], tX + 4, ty2);
        pg.setFill.apply(pg, DT); pg.setFont(true, 8); pg.drawText(r[1], tX + tW3 - 4, ty2, 'right');
      });
      y += tInH + 1;
      pg.setFill.apply(pg, G); pg.fillRect(tX, y, tW3, 20);
      pg.setFill(0.92,0.68,0.25); pg.setFont(true, 8.5); pg.drawText('GRAND TOTAL', tX + 4, y + 14); pg.drawText(fmtINR(c.grand), tX + tW3 - 4, y + 14, 'right');
      y += 22;
      if (c.adv > 0) { pg.setFill.apply(pg, T); pg.setFont(false, 8); pg.drawText('Advance – '+fmtINR(c.adv), tX + 4, y + 9); y += 14; }
      pg.setFill(1,0.97,0.82); pg.fillRect(tX, y, tW3, 19);
      pg.setFill.apply(pg, AM3); pg.setFont(true, 8.5); pg.drawText('BALANCE DUE', tX + 4, y + 13); pg.drawText(fmtINR(c.bal), tX + tW3 - 4, y + 13, 'right');
      y += 27;

      /* ── Amount in words ── */
      var wW2 = tX - M - 7;
      if (wW2 > 20) {
        pg.setFill.apply(pg, LG); pg.fillRect(M, y - 8, wW2, 22);
        pg.setFill(0.18,0.38,0.18); pg.setFont(true, 6); pg.drawText('AMOUNT IN WORDS', M + 3, y - 2);
        pg.setFill.apply(pg, DT); pg.setFont(false, 8); pg.drawText(d.inWords.substring(0,52), M + 3, y + 11);
      }

      if (d.remarks) {
        pg.setFill(1,0.98,0.88); pg.fillRect(M, y, PW - 2*M, 19);
        pg.setFill(0.83,0.45,0.04); pg.fillRect(M, y, 3, 19);
        pg.setFill.apply(pg, AM3); pg.setFont(true, 7); pg.drawText('REMARKS:', M + 6, y + 7);
        pg.setFont(false, 8); pg.drawText(d.remarks.substring(0,72), M + 6, y + 14);
        y += 23;
      }

      /* ── Signatures ── */
      var sY = Math.max(y + 18, 754);
      pg.setStroke.apply(pg, G); pg.setLineWidth(0.7);
      pg.hLine(M, M + 90, sY); pg.hLine(PW - M - 90, PW - M, sY);
      pg.setFill.apply(pg, T); pg.setFont(false, 8);
      pg.drawText("Farmer's Signature", M, sY + 11);
      pg.drawText("Authorised Signatory", PW - M - 90, sY + 11);

      /* ── Footer band ── */
      pg.setFill.apply(pg, G); pg.fillRect(0, 822, PW, 20);
      pg.setFill(0.55,0.74,0.45); pg.setFont(false, 7);
      pg.drawText('KisaanBill  ·  Computer-Generated Invoice  ·  ' + d.genAt, PW / 2, 834, 'center');

      doc.save('Invoice_' + (d.invoiceNo || 'KB') + '_' + (d.farmerName || 'Farmer') + '.pdf');
      showToast('PDF downloaded!');
    } catch (e) {
      console.error('PDF error:', e);
      alert('PDF export error: ' + e.message);
    } finally { hideLoader(); }
  }, 60);
}

/* ══════════════════════════════════════════════════════
   EXPORT — EXCEL  (uses KBExcel engine)
══════════════════════════════════════════════════════ */
function exportExcel() {
  if (!requireFields()) return;
  if (typeof KBExcel === 'undefined') { alert('Excel engine not loaded. Please refresh.'); return; }
  showLoader('Generating Excel…');
  setTimeout(function () {
    try {
      var d = getData(), c = d.c;
      var wb = new KBExcel();

      var s1 = [
        ['KISAANBILL - TRACTOR RENT INVOICE', '', '', '', '', ''],
        [''],
        ['Invoice No:', d.invoiceNo, '', 'Date:', d.invoiceDate ? fmtDate(d.invoiceDate) : ''],
        ['Due Date:', d.dueDate ? fmtDate(d.dueDate) : '', '', 'Payment:', d.payMode],
        [''],
        ['SERVICE PROVIDER', '', '', 'CUSTOMER (FARMER)'],
        ['Name:', d.ownerName, '', 'Name:', d.farmerName],
        ['Phone:', d.ownerPhone, '', 'Phone:', d.farmerPhone],
        ['Address:', d.ownerAddress, '', 'Address:', d.farmerAddress],
        ['GST/PAN:', d.ownerGST, '', '', ''],
        ['Bank/UPI:', d.ownerBank, '', '', ''],
        [''],
        ['TRACTOR DETAILS'],
        ['Model:', d.tractorModel, '', 'Reg. No.:', d.tractorReg],
        ['HP:', d.tractorHP ? d.tractorHP + ' HP' : '', '', 'Implement:', d.implement],
        ['Fuel:', d.fuelType, '', 'Operator:', d.operatorName],
        ['Crop:', d.cropType, '', 'Area:', d.landArea ? d.landArea + ' ' + d.areaUnit : ''],
        ['Work Start:', d.workStart ? fmtDate(d.workStart) : '', '', 'Work End:', d.workEnd ? fmtDate(d.workEnd) : ''],
        [''],
        ['#', 'DESCRIPTION', 'UNIT', 'QTY', 'RATE (INR)', 'AMOUNT (INR)']
      ];

      var rn3 = 1;
      if (c.svc > 0) s1.push([rn3++, 'Tractor Rental (' + (d.rateBasis || 'service') + ')' + (d.tractorModel ? ' – ' + d.tractorModel : ''), d.bLbl, d.workQty, d.workRate, c.svc]);
      d.lineItems.forEach(function (i) { s1.push([rn3++, i.desc, i.unit, i.qty, i.rate, i.amount]); });
      [['Diesel / Fuel', c.fuel],['Operator Wage', c.wage],['Travel', c.trav],['Other', c.othr]].forEach(function (ch) {
        if (ch[1] > 0) s1.push([rn3++, ch[0], '—', 1, ch[1], ch[1]]);
      });
      s1.push([''], ['', '', '', '', 'Subtotal', c.sub]);
      if (c.dAmt > 0) s1.push(['', '', '', '', 'Discount (' + c.dPct + '%)', -c.dAmt]);
      if (c.gAmt > 0) s1.push(['', '', '', '', 'GST (' + c.gPct + '%)', c.gAmt]);
      s1.push(['', '', '', '', 'GRAND TOTAL', c.grand]);
      if (c.adv > 0) s1.push(['', '', '', '', 'Advance Paid', -c.adv]);
      s1.push(['', '', '', '', 'BALANCE DUE', c.bal], [''], ['Amount in Words:', d.inWords]);
      if (d.remarks) s1.push(['Remarks:', d.remarks]);
      s1.push(['Generated:', d.genAt]);

      wb.addSheet('Invoice', s1);
      wb.addSheet('Calculation', [
        ['CALCULATION BREAKDOWN'], [''],
        ['Parameter', 'Value (INR)'],
        ['Service Charge', c.svc], ['Line Items', c.lines],
        ['Fuel', c.fuel], ['Operator Wage', c.wage], ['Travel', c.trav], ['Other', c.othr],
        ['Additional Total', c.extra], ['Subtotal', c.sub],
        ['Discount (' + c.dPct + '%)', c.dAmt], ['After Discount', c.afterD],
        ['GST (' + c.gPct + '%)', c.gAmt], ['GRAND TOTAL', c.grand],
        ['Advance Paid', c.adv], ['BALANCE DUE', c.bal]
      ]);

      wb.save('Invoice_' + (d.invoiceNo || 'KB') + '_' + (d.farmerName || 'Farmer') + '.xlsx');
      showToast('Excel downloaded!');
    } catch (e) {
      console.error('Excel error:', e);
      alert('Excel export error: ' + e.message);
    } finally { hideLoader(); }
  }, 60);
}

/* ══════════════════════════════════════════════════════
   EXPORT — WORD  (uses KBDocx engine)
══════════════════════════════════════════════════════ */
function exportWord() {
  if (!requireFields()) return;
  if (typeof KBDocx === 'undefined') { alert('Word engine not loaded. Please refresh.'); return; }
  showLoader('Generating Word document…');
  setTimeout(function () {
    try {
      var d = getData(), c = d.c;
      var doc2 = new KBDocx();

      function h(txt, sz, col) { doc2.para({ text: txt, bold: true, size: sz || 12, color: col || '1A3A1A', spaceBefore: 100, spaceAfter: 60 }); }
      function kv(lbl, val) {
        if (!val) return;
        doc2.para({ text: [{ text: lbl + ': ', bold: true, size: 10, color: '406040' }, { text: String(val), size: 10 }], spaceAfter: 50 });
      }

      doc2.para({ text: 'TRACTOR RENT INVOICE', bold: true, size: 18, color: '1A3A1A', align: 'center', spaceAfter: 40 });
      doc2.para({ text: 'KisaanBill — Invoice System', italic: true, size: 9, color: '6B806A', align: 'center', spaceAfter: 140 });
      doc2.rule();

      h('Invoice Details', 12);
      kv('Invoice No', d.invoiceNo); kv('Date', d.invoiceDate ? fmtDate(d.invoiceDate) : '');
      kv('Due Date', d.dueDate ? fmtDate(d.dueDate) : ''); kv('Payment', d.payMode);
      doc2.space(8);

      h('Service Provider');
      kv('Name', d.ownerName); kv('Phone', d.ownerPhone); kv('Address', d.ownerAddress); kv('GST/PAN', d.ownerGST); kv('Bank/UPI', d.ownerBank);
      doc2.space(8);

      h('Customer (Farmer)');
      kv('Name', d.farmerName); kv('Phone', d.farmerPhone); kv('Address', d.farmerAddress);
      doc2.space(8);

      h('Tractor & Work Details');
      kv('Model', d.tractorModel); kv('Reg. No.', d.tractorReg);
      kv('HP', d.tractorHP ? d.tractorHP + ' HP' : ''); kv('Implement', d.implement);
      kv('Fuel', d.fuelType); kv('Operator', d.operatorName); kv('Crop', d.cropType);
      kv('Area', d.landArea ? d.landArea + ' ' + d.areaUnit : '');
      kv('Work Period', d.workStart && d.workEnd ? fmtDate(d.workStart) + ' to ' + fmtDate(d.workEnd) : '');
      doc2.space(8);

      h('Service Items');

      /* Table */
      var hdrRow = [
        { text: '#',          bold: true, color: 'FFFFFF', bg: '1F4420', align: 'center', size: 9, width: 400 },
        { text: 'Description',bold: true, color: 'FFFFFF', bg: '1F4420', size: 9, width: 2800 },
        { text: 'Unit',       bold: true, color: 'FFFFFF', bg: '1F4420', align: 'center', size: 9, width: 800 },
        { text: 'Qty',        bold: true, color: 'FFFFFF', bg: '1F4420', align: 'center', size: 9, width: 700 },
        { text: 'Rate (Rs)', bold: true, color: 'FFFFFF', bg: '1F4420', align: 'right', size: 9, width: 1300 },
        { text: 'Amount (Rs)',bold: true, color: 'FFFFFF', bg: '1F4420', align: 'right', size: 9, width: 1500 }
      ];

      var tblRows2 = [hdrRow];
      var rn4 = 1;
      if (c.svc > 0) {
        tblRows2.push([
          { text: String(rn4++), align: 'center', size: 9, width: 400 },
          { text: 'Tractor Rental (' + (d.rateBasis || '') + ')' + (d.tractorModel ? ' - ' + d.tractorModel : ''), size: 9, width: 2800 },
          { text: d.bLbl, align: 'center', size: 9, width: 800 },
          { text: String(d.workQty), align: 'center', size: 9, width: 700 },
          { text: fmtINR(d.workRate), align: 'right', size: 9, width: 1300 },
          { text: fmtINR(c.svc), bold: true, align: 'right', size: 9, width: 1500 }
        ]);
      }
      d.lineItems.forEach(function (item) {
        tblRows2.push([
          { text: String(rn4++), align: 'center', size: 9, width: 400 },
          { text: item.desc, size: 9, width: 2800 },
          { text: item.unit, align: 'center', size: 9, width: 800 },
          { text: String(item.qty), align: 'center', size: 9, width: 700 },
          { text: fmtINR(item.rate), align: 'right', size: 9, width: 1300 },
          { text: fmtINR(item.amount), bold: true, align: 'right', size: 9, width: 1500 }
        ]);
      });
      [['Diesel / Fuel', c.fuel],['Operator Wage', c.wage],['Travel', c.trav],['Other', c.othr]].forEach(function (ch) {
        if (ch[1] > 0) tblRows2.push([
          { text: String(rn4++), align: 'center', size: 9, width: 400 },
          { text: ch[0], size: 9, width: 2800 },
          { text: '-', align: 'center', size: 9, width: 800 },
          { text: '1', align: 'center', size: 9, width: 700 },
          { text: fmtINR(ch[1]), align: 'right', size: 9, width: 1300 },
          { text: fmtINR(ch[1]), bold: true, align: 'right', size: 9, width: 1500 }
        ]);
      });

      doc2.table(tblRows2, 7500);
      doc2.space(6);

      h('Totals');
      kv('Subtotal', fmtINR(c.sub));
      if (c.dAmt > 0) kv('Discount (' + c.dPct + '%)', '- ' + fmtINR(c.dAmt));
      if (c.gAmt > 0) kv('GST (' + c.gPct + '%)', fmtINR(c.gAmt));
      doc2.para({ text: 'GRAND TOTAL: ' + fmtINR(c.grand), bold: true, size: 13, color: 'C47A08', spaceBefore: 60, spaceAfter: 50 });
      if (c.adv > 0) kv('Advance Paid', '- ' + fmtINR(c.adv));
      doc2.para({ text: 'BALANCE DUE: ' + fmtINR(c.bal), bold: true, size: 12, color: 'C47A08', spaceAfter: 120 });
      doc2.para({ text: 'Amount in Words: ' + d.inWords, italic: true, size: 10, color: '3D5A2A', spaceAfter: 80 });
      if (d.remarks) kv('Remarks', d.remarks);

      doc2.space(30);
      doc2.table([[
        { text: '___________________________\nFarmer\'s Signature', size: 9, color: '6B806A', width: 4500 },
        { text: '___________________________\nAuthorised Signatory', size: 9, color: '6B806A', align: 'right', width: 4500 }
      ]], 9000);
      doc2.space(14);
      doc2.para({ text: 'Generated by KisaanBill  .  ' + d.genAt, italic: true, size: 8, color: 'AAB89A', align: 'center' });

      doc2.save('Invoice_' + (d.invoiceNo || 'KB') + '_' + (d.farmerName || 'Farmer') + '.docx');
      showToast('Word document downloaded!');
    } catch (e) {
      console.error('Word error:', e);
      alert('Word export error: ' + e.message);
    } finally { hideLoader(); }
  }, 60);
}

/* ══════════════════════════════════════════════════════
   EXPORT — CSV
══════════════════════════════════════════════════════ */
function exportCSV() {
  if (!requireFields()) return;
  showLoader('Generating CSV…');
  setTimeout(function () {
    try {
      var d = getData(), c = d.c;
      function row() {
        return Array.from(arguments).map(function (v) {
          return '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
        }).join(',');
      }
      var lines = [
        row('KISAANBILL - TRACTOR RENT INVOICE'),
        row('Invoice No', d.invoiceNo, 'Date', d.invoiceDate ? fmtDate(d.invoiceDate) : ''),
        row('Due Date', d.dueDate ? fmtDate(d.dueDate) : '', 'Payment', d.payMode),
        row('Owner', d.ownerName, 'Phone', d.ownerPhone),
        row('Address', d.ownerAddress, 'GST/PAN', d.ownerGST),
        row('Farmer', d.farmerName, 'Phone', d.farmerPhone),
        row('Farm Address', d.farmerAddress),
        row('Tractor', d.tractorModel, 'Reg', d.tractorReg),
        row('Implement', d.implement, 'Fuel', d.fuelType),
        row('Operator', d.operatorName, 'Crop', d.cropType),
        row('Area', d.landArea ? d.landArea + ' ' + d.areaUnit : '', 'Work Start', d.workStart ? fmtDate(d.workStart) : ''),
        row('Work End', d.workEnd ? fmtDate(d.workEnd) : ''),
        row(''),
        row('#', 'DESCRIPTION', 'UNIT', 'QTY', 'RATE (INR)', 'AMOUNT (INR)')
      ];
      var rn5 = 1;
      if (c.svc > 0) lines.push(row(rn5++, 'Tractor Rental (' + (d.rateBasis || '') + ')' + (d.tractorModel ? ' - ' + d.tractorModel : ''), d.bLbl, d.workQty, d.workRate, c.svc));
      d.lineItems.forEach(function (i) { lines.push(row(rn5++, i.desc, i.unit, i.qty, i.rate, i.amount)); });
      [['Diesel/Fuel',c.fuel],['Operator Wage',c.wage],['Travel',c.trav],['Other',c.othr]].forEach(function (ch) { if (ch[1]>0) lines.push(row(rn5++, ch[0], '-', 1, ch[1], ch[1])); });
      lines.push(row(''), row('','','','','Subtotal',c.sub));
      if (c.dAmt>0) lines.push(row('','','','','Discount ('+c.dPct+'%)',-c.dAmt));
      if (c.gAmt>0) lines.push(row('','','','','GST ('+c.gPct+'%)',c.gAmt));
      lines.push(row('','','','','GRAND TOTAL',c.grand));
      if (c.adv>0) lines.push(row('','','','','Advance Paid',-c.adv));
      lines.push(row('','','','','BALANCE DUE',c.bal), row(''), row('Amount in Words',d.inWords));
      if (d.remarks) lines.push(row('Remarks',d.remarks));
      lines.push(row('Generated',d.genAt));

      var csv = '\uFEFF' + lines.join('\r\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement('a');
      a.href = url; a.download = 'Invoice_' + (d.invoiceNo || 'KB') + '_' + (d.farmerName || 'Farmer') + '.csv';
      a.style.display = 'none';
      document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 400);
      showToast('CSV downloaded!');
    } catch (e) {
      console.error('CSV error:', e);
      alert('CSV export error: ' + e.message);
    } finally { hideLoader(); }
  }, 60);
}

/* ══════════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════════ */
function g(id)   { return document.getElementById(id); }
function gv(id)  { var el = g(id); return el ? el.value.trim() : ''; }
function st(id, t) { var el = g(id); if (el) el.textContent = t; }
function r2(n)   { return Math.round(((parseFloat(n) || 0) + Number.EPSILON) * 100) / 100; }
function fmtN(n) { return (parseFloat(n) || 0).toFixed(2); }
function fmtINR(n) {
  return '\u20B9\u00A0' + (parseFloat(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso) {
  if (!iso) return '—';
  var p = String(iso).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
}
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

var _toast = null;
function showToast(msg) {
  var t = g('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(_toast);
  _toast = setTimeout(function () { t.classList.remove('show'); }, 2800);
}
function showLoader(msg) {
  var b = g('loaderBg'), m = g('loaderMsg');
  if (m) m.textContent = msg || 'Please wait…';
  if (b) b.classList.add('show');
}
function hideLoader() { var b = g('loaderBg'); if (b) b.classList.remove('show'); }

function amountInWords(amount) {
  var n = Math.round(parseFloat(amount) || 0);
  if (n === 0) return 'Zero Rupees Only';
  if (n < 0)   return 'Minus ' + amountInWords(-n);
  var ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  var tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function tw(x) { return x<=0?'':x<20?ones[x]:tens[Math.floor(x/10)]+(x%10?' '+ones[x%10]:''); }
  function th(x) { return x<=0?'':x<100?tw(x):ones[Math.floor(x/100)]+' Hundred'+(x%100?' '+tw(x%100):''); }
  var res = '', rem = n;
  if (rem>=10000000){res+=th(Math.floor(rem/10000000))+' Crore ';rem%=10000000;}
  if (rem>=100000)  {res+=th(Math.floor(rem/100000))+' Lakh ';  rem%=100000;}
  if (rem>=1000)    {res+=th(Math.floor(rem/1000))+' Thousand ';rem%=1000;}
  if (rem>0)        {res+=th(rem);}
  return res.trim()+' Rupees Only';
}
