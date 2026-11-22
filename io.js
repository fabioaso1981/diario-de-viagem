'use strict';
/* ===== Backup, resumo, CSV e importação ===== */
/* ----- fotos dentro dos backups (ficam em base64 no arquivo) ----- */
const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
async function photosForTrip(order, seen = new Set()) {
  const out = [];
  if (!idbOk || !IDB.db) return out;
  for (const d of order) {
    try { for (const p of await IDB.photosOf(d)) { if (seen.has(p.id)) continue; seen.add(p.id); out.push({ id: p.id, dayId: p.dayId, ts: p.ts, data: await blobToDataURL(p.blob) }); } } catch (e) { /* ok */ }
  }
  return out;
}
async function restorePhotos(list) {
  let n = 0;
  if (!Array.isArray(list) || !idbOk || !IDB.db) return n;
  for (const p of list) {
    try { const blob = await (await fetch(p.data)).blob(); await IDB.put('photos', { id: p.id, dayId: p.dayId, ts: p.ts, blob }); n++; } catch (e) { /* ok */ }
  }
  return n;
}
/* monta o JSON em partes (evita uma string gigante quando há muitas fotos) */
function jsonBlob(base, photos) {
  const parts = [JSON.stringify(base).slice(0, -1) + ',"photos":['];
  photos.forEach((p, i) => parts.push((i ? ',' : '') + JSON.stringify(p)));
  parts.push(']}');
  return new Blob(parts, { type: 'application/json' });
}
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
  persist();
  const photos = await photosForTrip(state.order);
  const ok = await shareOrDownload(jsonBlob({ ...state, exportedAt: Date.now() }, photos), `${fileSlug()}-backup-${todayISO()}.json`, 'application/json');
  if (ok) { markBackup(); toast(`Backup exportado${photos.length ? ` (com ${photos.length} foto${photos.length > 1 ? 's' : ''})` : ''}.`); }
}
/* Backup de TODAS as viagens (plano Organizador): viagens, fotos, licença e configurações em um arquivo */
async function exportAllFile() {
  if (!canFullBackup()) return openPaywall('backupAll');
  persist(); toast('Preparando o backup completo…');
  const trips = {}, photos = [], seen = new Set();
  for (const t of meta.trips) {
    const s = t.id === state.id ? state : await readTrip(t.id);
    trips[t.id] = s; photos.push(...await photosForTrip(s.order, seen));
  }
  const base = { app: 'ushuaia2027', kind: 'full', v: 1, exportedAt: Date.now(),
    meta: { active: meta.active, trips: meta.trips, license: meta.license || null, trial: meta.trial || null, ocrUse: meta.ocrUse || null }, trips };
  const ok = await shareOrDownload(jsonBlob(base, photos), `dibordo-backup-completo-${todayISO()}.json`, 'application/json');
  if (ok) { markBackup(); toast(`Backup completo exportado: ${meta.trips.length} viagem(ns) e ${photos.length} foto(s).`); }
}
async function restoreAllDo() {
  const inc = pendingImport; pendingImport = null;
  if (!inc || inc.kind !== 'full') return;
  const photos = inc.photos || []; delete inc.photos;
  const list = ((inc.meta && inc.meta.trips) || []).filter(t => inc.trips && inc.trips[t.id]).map(t => { const s = migrate(inc.trips[t.id]); s.id = t.id; return s; });
  if (!list.length) { closeModal(); return toast('O arquivo não tem nenhuma viagem.'); }
  toast('Restaurando…');
  persist();
  /* apaga as viagens atuais (e suas fotos) e troca pelas do arquivo */
  for (const t of [...meta.trips]) { const s = t.id === state.id ? state : await readTrip(t.id); await deleteTripPhotos(s.order); await dropTripData(t.id); }
  meta.trips = list.map(s => ({ id: s.id, name: s.settings.tripName, mode: s.mode }));
  meta.active = list.some(s => s.id === inc.meta.active) ? inc.meta.active : list[0].id;
  state = list.find(s => s.id === meta.active); ensureVehicles();
  for (const s of list) {
    if (idbOk && IDB.db) { try { await IDB.put('kv', JSON.parse(JSON.stringify(s)), kvKey(s.id)); } catch (e) { /* ok */ } }
    try { localStorage.setItem(lsKey(s.id), JSON.stringify(s)); } catch (e) { /* ok */ }
  }
  /* licença: só vale se a assinatura conferir e não estiver vencida; mantém a melhor entre a do arquivo e a deste aparelho */
  const fl = inc.meta.license;
  if (fl && fl.code) {
    try { const L = await verifyCode(fl.code); if (L.exp >= todayISO() && (!meta.license || L.exp > meta.license.exp)) meta.license = { code: fl.code, plan: L.plan, exp: L.exp, id: L.id, name: L.name }; } catch (e) { /* código inválido: ignora */ }
  }
  if (inc.meta.trial && !meta.trial) meta.trial = inc.meta.trial;
  const fu = inc.meta.ocrUse; if (fu && (!meta.ocrUse || (fu.m === meta.ocrUse.m && fu.n > meta.ocrUse.n))) meta.ocrUse = fu;
  persist();
  const np = await restorePhotos(photos);
  resetUiForTrip(); applyTheme(); closeModal(); renderHeader(); renderView();
  toast(`Backup completo restaurado: ${list.length} viagem(ns) e ${np} foto(s).`);
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
      if (obj.kind === 'full') {
        const names = ((obj.meta && obj.meta.trips) || []).map(t => esc(t.name)).join(', ');
        const nT = ((obj.meta && obj.meta.trips) || []).length;
        openModal(`<h2>📥 Restaurar backup completo</h2><p class="small"><b>${nT} viagem(ns):</b> ${names}.<br>${(obj.photos || []).length} foto(s)${obj.meta && obj.meta.license ? ' • inclui a licença do plano' : ''}${obj.exportedAt ? ' • exportado em ' + fmtDT(obj.exportedAt) : ''}.</p>
          <p class="small neg" style="margin-top:6px"><b>Atenção:</b> restaurar troca TODAS as viagens deste aparelho pelas do arquivo. O que existe aqui e não está no arquivo será apagado.</p>
          ${btns(B('restoreAll', 'Restaurar tudo', 'danger'), B('closeModal', 'Cancelar', 'ghost'))}`);
        return;
      }
      openModal(`<h2>📥 Importar backup</h2><p class="small"><b>${esc((obj.settings && obj.settings.tripName) || 'Viagem')}</b> — ${(obj.expenses || []).length} lançamentos, ${(obj.people || []).length} pessoas${(obj.photos || []).length ? ' e ' + obj.photos.length + ' foto(s)' : ''}${obj.exportedAt ? ' (exportado em ' + fmtDT(obj.exportedAt) + ')' : ''}.</p>
        <p class="small muted" style="margin-top:6px"><b>Mesclar</b> mantém o que você já tem nesta viagem e acrescenta o que falta (ideal para juntar dados do grupo). <b>Substituir</b> troca esta viagem pelo arquivo. <b>Nova viagem</b> adiciona como outra viagem.</p>
        ${btns(B('importDo', 'Mesclar', 'ok', 'data-mode="merge"'), B('importDo', 'Nova viagem', 'amber', 'data-mode="new"'), B('importDo', 'Substituir', 'danger', 'data-mode="replace"'), B('closeModal', 'Cancelar', 'ghost'))}`);
    } catch (err) { toast('Arquivo inválido: não é um backup deste app.'); }
  };
  r.readAsText(f);
});
async function importDo(mode) {
  const inc = pendingImport; pendingImport = null; if (!inc) return;
  const photos = inc.photos; delete inc.photos;   /* as fotos não fazem parte do estado da viagem */
  if (mode === 'replace') { const s = migrate(inc); s.id = state.id; state = s; }
  else if (mode === 'new') { persist(); const s = migrate(inc); s.id = 't' + uid(); state = s; meta.active = s.id; resetUiForTrip(); }
  else mergeState(inc);
  save(); persist(); applyTheme(); closeModal(); renderHeader(); renderView();
  const np = await restorePhotos(photos);
  toast((mode === 'replace' ? 'Dados substituídos.' : mode === 'new' ? 'Viagem importada.' : 'Dados mesclados.') + (np ? ` ${np} foto(s) restaurada(s).` : ''));
}
