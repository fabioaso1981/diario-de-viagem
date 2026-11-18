'use strict';
/* ===== Backup, resumo, CSV e importação ===== */
function snapshot() { return JSON.stringify({ ...state, exportedAt: Date.now() }, null, 1); }
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function markBackup() { state.settings.lastBackup = Date.now(); save(); refresh(); }
async function shareOrDownload(blob, name, type) {
  const file = new File([blob], name, { type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return true; }
  } catch (e) { if (e && e.name === 'AbortError') return false; }
  download(blob, name); return true;
}
const fileSlug = () => state.settings.tripName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'viagem';
async function exportFile() {
  const ok = await shareOrDownload(new Blob([snapshot()], { type: 'application/json' }), `${fileSlug()}-backup-${todayISO()}.json`, 'application/json');
  if (ok) { markBackup(); toast('Backup exportado.'); }
}
function summaryText() {
  const st = tripStats(), total = sumBRL(state.expenses), bal = balances();
  let t = `${state.settings.tripName.toUpperCase()} — RESUMO (${fmtDT(Date.now())})\n`;
  t += `Dias concluídos: ${st.nDone}/${st.act.length} • ${nf(st.done)} km percorridos • faltam ${nf(st.remaining)} km\n`;
  t += `Total gasto: ${BRL(total)}\n\nGRUPO:\n`;
  state.people.forEach(p => { const v = bal[p.id]; t += `- ${p.name}${p.active === false ? ' (fora)' : ''}: pagou ${BRL(v.paid)}, consumiu ${BRL(v.share)}\n`; });
  settlements(bal).forEach(s => { t += `  → ${pName(s.from)} paga ${BRL(s.v)} a ${pName(s.to)}\n`; });
  t += `\nDIAS:\n`;
  st.days.forEach(d => { if (d.status !== 'pending') t += `- Dia ${dayNumber(d.id)} ${fmtShort(d.date)} ${d.origin} → ${d.dest}: ${STATUS[d.status]}${realKm(d) != null ? ' • ' + nf(realKm(d)) + ' km' : ''}\n`; });
  t += `\nDESPESAS:\n`;
  [...state.expenses].sort((a, b) => a.ts - b.ts).forEach(e => { t += `- ${fmtDT(e.ts)} ${CATS[e.category]?.label || e.category}: ${fmtCur(e.amount, e.currency)}${e.currency !== 'BRL' ? ' (' + BRL(e.brl) + ')' : ''}${e.desc ? ' — ' + e.desc : ''}\n`; });
  return t;
}
async function copyText(t, okMsg) {
  try { await navigator.clipboard.writeText(t); toast(okMsg || 'Copiado!'); }
  catch (e) { openModal(`<h2>Copie o texto</h2><textarea style="min-height:260px" readonly>${esc(t)}</textarea>${btns(B('closeModal', 'Fechar', 'ghost'))}`); }
}
async function exportCsv() {
  const q = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const rows = [['data_hora', 'dia', 'categoria', 'descricao', 'valor', 'moeda', 'cotacao', 'valor_brl', 'pago_por', 'dividido_entre', 'litros', 'odometro', 'veiculo', 'tanque_cheio']];
  [...state.expenses].sort((a, b) => a.ts - b.ts).forEach(e => rows.push([toLocalInput(e.ts).replace('T', ' '), dayNumber(e.dayId), CATS[e.category]?.label, e.desc, String(e.amount).replace('.', ','), e.currency,
    String(e.rate || '').replace('.', ','), String(Math.round(e.brl * 100) / 100).replace('.', ','), e.paidBy ? pName(e.paidBy) : '', (e.split || []).map(pName).join(' + '), e.liters || '', e.odo || '', e.who ? vName(e.who) : '', e.category === 'abastecimento' ? (e.full ? 'sim' : 'não') : '']));
  const blob = new Blob(['﻿' + rows.map(r => r.map(q).join(';')).join('\r\n')], { type: 'text/csv' });
  await shareOrDownload(blob, `${fileSlug()}-gastos-${todayISO()}.csv`, 'text/csv');
}

function mergeState(inc) {
  const m = migrate(inc);
  const addById = (mine, theirs) => theirs.forEach(x => { if (!mine.some(y => y.id === x.id)) mine.push(x); });
  addById(state.people, m.people); addById(state.vehicles, m.vehicles); addById(state.expenses, m.expenses); addById(state.contacts, m.contacts); addById(state.extra, m.extra);
  m.order.forEach((id, i) => {
    if (state.order.includes(id)) return;
    let pos = state.order.length;
    for (let j = i - 1; j >= 0; j--) { const k = state.order.indexOf(m.order[j]); if (k >= 0) { pos = k + 1; break; } }
    state.order.splice(pos, 0, id);
  });
  Object.entries(m.days).forEach(([id, theirs]) => {
    const mine = ovr(id);
    Object.keys(theirs).forEach(k => {
      if (k === 'log') { mine.log = mine.log || []; addById(mine.log, theirs.log); }
      else if (k === 'hotel') { mine.hotel = Object.assign({}, theirs.hotel, Object.fromEntries(Object.entries(mine.hotel || {}).filter(([, v]) => v))); }
      else if (mine[k] === undefined || mine[k] === '' || (k === 'status' && mine.status === 'pending')) mine[k] = theirs[k];
    });
  });
  Object.assign(state.checks, m.checks);
  Object.keys(m.customItems).forEach(l => { state.customItems[l] = state.customItems[l] || []; addById(state.customItems[l], m.customItems[l]); });
  if (!state.setupDone && m.setupDone) state.setupDone = true;
}

$('importInput').addEventListener('change', e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const obj = JSON.parse(r.result);
      if (obj.app !== 'ushuaia2027') throw new Error('arquivo inválido');
      pendingImport = obj;
      openModal(`<h2>📥 Importar backup</h2><p class="small"><b>${esc((obj.settings && obj.settings.tripName) || 'Viagem')}</b> — ${(obj.expenses || []).length} lançamentos e ${(obj.people || []).length} pessoas${obj.exportedAt ? ' (exportado em ' + fmtDT(obj.exportedAt) + ')' : ''}.</p>
        <p class="small muted" style="margin-top:6px"><b>Mesclar</b> mantém o que você já tem nesta viagem e acrescenta o que falta (ideal para juntar dados do grupo). <b>Substituir</b> troca esta viagem pelo arquivo. <b>Nova viagem</b> adiciona como outra viagem.</p>
        ${btns(B('importDo', 'Mesclar', 'ok', 'data-mode="merge"'), B('importDo', 'Nova viagem', 'amber', 'data-mode="new"'), B('importDo', 'Substituir', 'danger', 'data-mode="replace"'), B('closeModal', 'Cancelar', 'ghost'))}`);
    } catch (err) { toast('Arquivo inválido: não é um backup deste app.'); }
  };
  r.readAsText(f);
});
function importDo(mode) {
  const inc = pendingImport; pendingImport = null; if (!inc) return;
  if (mode === 'replace') { const s = migrate(inc); s.id = state.id; state = s; }
  else if (mode === 'new') { persist(); const s = migrate(inc); s.id = 't' + uid(); state = s; meta.active = s.id; resetUiForTrip(); }
  else mergeState(inc);
  save(); persist(); applyTheme(); closeModal(); renderHeader(); renderView();
  toast(mode === 'replace' ? 'Dados substituídos.' : mode === 'new' ? 'Viagem importada.' : 'Dados mesclados.');
}
