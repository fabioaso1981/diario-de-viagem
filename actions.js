'use strict';
/* ===== Ações (cliques) ===== */
function oilDone(id) {
  const v = state.vehicles.find(x => x.id === id); if (!v) return;
  const cur = vehicleOdo(v);
  if (cur == null) return toast('Informe primeiro o odômetro atual do veículo (aba Grupo).');
  if (!confirm(`Registrar a troca de óleo e filtro de "${v.name}" no odômetro ${nf(cur)}?`)) return;
  v.oilLastOdo = cur; save(); refresh();
  openExpense({ category: 'manutencao', desc: 'Troca de óleo e filtro — ' + v.name });
}
async function deleteTripPhotos(order) {
  if (!idbOk || !IDB.db) return;
  for (const d of order) { try { (await IDB.photosOf(d)).forEach(p => IDB.del('photos', p.id)); } catch (e) { /* ok */ } }
}

const ACT = {
  nav: d => setView(d.view),
  toggleDash: () => { dashOpen = !dashOpen; renderHeader(); },
  filter: d => { routeFilter = d.f; renderRoute(); },
  finFilter: d => { finFilter = d.f; renderFinance(); },
  goCur: () => goCurrent(),
  expand: d => { expandedState[d.id] = !isOpenDay(d.id, currentDayId()); refresh(); },
  status: d => {
    const o = ovr(d.id), prev = o.status || 'pending', next = prev === d.st ? 'pending' : d.st;
    if (next === 'pending') delete o.status; else o.status = next;
    if (next === 'done') expandedState[d.id] = false;
    save(); refresh();
    if (next === 'done') { const dd = getDay(d.id); if (dd.odoEnd == null && dd.kmManual == null) toast('Dia concluído. Registrar a quilometragem?', 'Registrar', () => openOdo(d.id)); }
  },
  openExp: d => openExpense({ id: d.id, dayId: d.day, category: d.cat }),
  odo: d => openOdo(d.id), saveOdo: d => saveOdo(d.id),
  editDay: d => openDayEdit(d.id), saveDay: d => saveDay(d.id),
  note: d => openLog(d.day, d.id || null), saveLog: d => saveLog(d.day, d.id || null),
  delLog: d => { const o = ovr(d.day); o.log = (o.log || []).filter(l => l.id !== d.id); save(); closeModal(); refresh(); },
  photo: d => { photoDay = d.id; $('photoInput').click(); },
  viewPhoto: d => viewPhoto(d.id),
  closeViewer: () => { const v = $('viewer'); if (v) v.remove(); },
  delPhoto: async d => { if (!confirm('Excluir esta foto?')) return; try { await IDB.del('photos', d.id); delete photoUrls[d.id]; } catch (e) { /* ok */ } ACT.closeViewer(); refresh(); },
  saveExp: () => saveExpense(),
  delExp: d => { if (!confirm('Excluir este lançamento?')) return; state.expenses = state.expenses.filter(e => e.id !== d.id); save(); closeModal(); refresh(); toast('Lançamento excluído.'); },
  closeModal: () => closeModal(),
  backdrop: () => { if (!modalDirty || confirm('Descartar o que foi digitado?')) closeModal(); },
  quick: () => openQuick(),
  qExp: d => { const day = $('q-day').value; openExpense({ dayId: day, category: d.cat }); },
  qOdo: () => openOdo($('q-day').value),
  qNote: () => openLog($('q-day').value),
  qPhoto: () => { photoDay = $('q-day').value; closeModal(); $('photoInput').click(); },
  qDone: () => { const id = $('q-day').value; ovr(id).status = 'done'; expandedState[id] = false; save(); closeModal(); refresh(); if (getDay(id).odoEnd == null) openOdo(id); },
  adjust: () => openAdjust(),
  applyPush: () => { const n = parseInt($('a-n').value, 10); if (!n) return toast('Informe quantos dias.'); shiftFrom($('a-from').value, n); save(); closeModal(); refresh(); toast(`Datas deslocadas em ${n} dia(s).`); },
  addExtra: () => { const id = addExtraDay($('a-after').value, $('a-title').value.trim(), $('a-push').checked); expandedState[id] = true; save(); closeModal(); refresh(); toast('Dia extra adicionado.'); },
  addFirstDay: () => { const id = addExtraDay(null, 'Primeiro dia', false); expandedState[id] = true; save(); refresh(); },
  resetDates: () => { if (!confirm('Voltar todas as datas ao plano original?')) return; Object.values(state.days).forEach(o => delete o.date); save(); closeModal(); refresh(); },
  pushThis: d => { shiftFrom(d.id, 1); save(); closeModal(); refresh(); toast('Este dia e os seguintes foram empurrados +1 dia.'); },
  resetDay: d => { const o = ovr(d.id); ['origin', 'dest', 'km', 'date'].forEach(k => delete o[k]); save(); closeModal(); refresh(); },
  delDay: d => {
    if (!confirm('Excluir este dia extra? Os gastos lançados nele passam para o dia anterior.')) return;
    const vo = visibleOrder(), idx = vo.indexOf(d.id), fallback = vo[idx - 1] || vo[idx + 1] || '';
    state.expenses.forEach(e => { if (e.dayId === d.id) e.dayId = fallback; });
    state.order = state.order.filter(x => x !== d.id); state.extra = state.extra.filter(x => x.id !== d.id); delete state.days[d.id];
    save(); closeModal(); refresh();
  },
  replan: () => { closeModal(); openReplan(); },
  rpAdd: () => rpAddRow(), rpDel: d => rpDelRow(+d.i), rpSave: () => rpSave(),
  undoReplan: () => undoReplan(),
  trips: () => openTrips(),
  openTrip: d => openTripById(d.id),
  delTrip: d => deleteTrip(d.id),
  planner: () => { closeModal(); if (!canCreateTrip()) return openPaywall('trips'); openPlanner(); },
  paywall: () => openPaywall(), paywallRoutes: () => openPaywall('routes'),
  activateCode: () => activateCode(), startTrial: () => startTrial(),
  routes: () => openRoutes(), routePrev: d => openRoutePreview(d.id), routeUse: d => openRouteUse(d.id), routeGo: d => routeCreate(d.id),
  plAdd: () => plAddRow(), plDel: d => plDelRow(+d.i), plCreate: () => plCreate(),
  oilDone: d => oilDone(d.id),
  addVehicle: () => { const i = $('new-vehicle'), n = i.value.trim(); if (!n) return toast('Digite o nome do veículo.'); state.vehicles.push({ id: uid(), name: n, active: true }); save(); renderGroup(); },
  toggleVehicle: d => { const v = state.vehicles.find(x => x.id === d.id); v.active = v.active === false; save(); renderGroup(); renderHeader(); },
  delVehicle: d => { if (!confirm('Remover este veículo?')) return; state.vehicles = state.vehicles.filter(v => v.id !== d.id); save(); renderGroup(); },
  ocrReceipt: () => startOcr({ kind: 'receipt', box: 'x-ocr' }),
  ocrOdoX: () => startOcr({ kind: 'odo', box: 'x-ocr', targets: [['x-odo', 'Odômetro']] }),
  ocrOdoD: () => startOcr({ kind: 'odo', box: 'o-ocr', targets: [['o-end', 'Chegada'], ['o-start', 'Saída']] }),
  ocrPick: d => { const el = $(d.target); if (!el) return; el.value = d.v; if (el.dataset.auto) el.dataset.auto = '0'; if ($('x-cat')) recalcExpense(); },
  toastAct: () => { const f = toastFn; $('toast').classList.remove('show'); if (f) f(); },
  chkp: d => { state.checks[d.key] = !state.checks[d.key]; if (!state.checks[d.key]) delete state.checks[d.key]; save(); renderLists(); },
  addItem: d => { const i = $('add-' + d.list), t = i.value.trim(); if (!t) return; (state.customItems[d.list] = state.customItems[d.list] || []).push({ id: 'c' + uid(), t }); save(); renderLists(); },
  delItem: d => { state.customItems[d.list] = (state.customItems[d.list] || []).filter(c => c.id !== d.id); save(); renderLists(); },
  addPerson: () => {
    const i = $('new-person'), n = i.value.trim(); if (!n) return toast('Digite o nome.');
    if (state.people.length >= maxPeople()) return openPaywall('people');
    state.people.push({ id: uid(), name: n, active: true });
    if (state.mode === 'moto') state.vehicles.push({ id: uid(), name: `Moto de ${n}`, active: true });
    save(); renderGroup(); renderHeader(); toast(`${n} entrou no grupo.`);
  },
  togglePerson: d => { const p = state.people.find(x => x.id === d.id); p.active = p.active === false; save(); renderGroup(); renderHeader(); },
  delPerson: d => { if (!confirm('Remover esta pessoa?')) return; state.people = state.people.filter(p => p.id !== d.id); save(); renderGroup(); renderHeader(); },
  exportFile: () => exportFile(),
  exportText: () => copyText(summaryText(), 'Resumo copiado — cole no WhatsApp.'),
  exportCsv: () => exportCsv(),
  importPick: () => $('importInput').click(),
  importDo: d => importDo(d.mode),
  persist: async () => { try { const ok = navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; toast(ok ? 'Armazenamento protegido.' : 'O navegador não concedeu. Instale o app na tela inicial e tente de novo.'); } catch (e) { toast('Não suportado.'); } updatePersistState(); },
  install: async () => { if (!deferredInstall) return; deferredInstall.prompt(); try { await deferredInstall.userChoice; } catch (e) { /* ok */ } deferredInstall = null; if (curView === 'more') renderMore(); },
  sos: () => sosGo(),
  sosCopy: () => copyText(sosText, 'Mensagem copiada.'),
  sosShare: async () => { try { await navigator.share({ text: sosText }); } catch (e) { copyText(sosText); } },
  editContact: d => openContact(d.id || null),
  saveContact: d => {
    const name = $('c-name').value.trim(), phone = $('c-phone').value.trim(); if (!name) return toast('Informe o nome.');
    const c = { id: d.id || uid(), name, phone, note: $('c-note').value.trim() }, i = state.contacts.findIndex(x => x.id === c.id);
    if (i >= 0) state.contacts[i] = c; else state.contacts.push(c);
    save(); closeModal(); renderMore();
  },
  delContact: d => { state.contacts = state.contacts.filter(c => c.id !== d.id); save(); closeModal(); renderMore(); },
  setupGo: () => { const names = $('s-names').value.split('\n').map(s => s.trim()).filter(Boolean); finishSetup(names.length ? names : ['Pessoa 1', 'Pessoa 2', 'Pessoa 3'], $('s-mode').value); },
  setupSkip: () => finishSetup(['Pessoa 1', 'Pessoa 2', 'Pessoa 3'], $('s-mode').value),
  zerar: () => openModal(`<h2>🗑️ Apagar os dados desta viagem?</h2><p class="small">Isso remove marcações, gastos, grupo, anotações e fotos de <b>${esc(state.settings.tripName)}</b> <b>neste aparelho</b>. Faça um backup antes. Digite <b>ZERAR</b> para confirmar.</p>
    <div class="fg" style="margin-top:8px"><input type="text" id="z-conf" autocapitalize="characters"></div>${btns(B('zerarGo', 'Apagar', 'danger'), B('closeModal', 'Cancelar', 'ghost'))}`),
  zerarGo: async () => {
    if ($('z-conf').value.trim().toUpperCase() !== 'ZERAR') return toast('Digite ZERAR para confirmar.');
    const id = state.id, tpl = state.template, name = state.settings.tripName, mode = state.mode;
    await deleteTripPhotos(state.order);
    state = tpl === 'ushuaia' ? defaultState('ushuaia') : defaultState(null, mode, name);
    state.id = id; resetUiForTrip(); applyTheme(); save(); persist(); closeModal(); renderHeader(); renderView(); openSetup();
  },
  reloadApp: () => location.reload()
};

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (fn) fn(el.dataset, el, ev);
});
document.addEventListener('input', ev => {
  if ($('sheet').contains(ev.target)) modalDirty = true;
  const k = ev.target.dataset && ev.target.dataset.inp;
  if (k === 'xrecalc') { if (ev.target.id === 'x-odo') ev.target.dataset.auto = '0'; recalcExpense(); }
  else if (k === 'plsum') plSummary();
});
document.addEventListener('change', ev => {
  const el = ev.target; if (!el.dataset) return;
  if ($('sheet').contains(el)) modalDirty = true;
  switch (el.dataset.chg) {
    case 'xrecalc': recalcExpense(); break;
    case 'xwho': onWhoChange(); break;
    case 'plsum': plSummary(); break;
    case 'rpFrom': rpChangeFrom(el.value); break;
    case 'tour': if (el.checked) state.checks[el.dataset.key] = true; else delete state.checks[el.dataset.key]; save(); el.closest('.tour').classList.toggle('dn', el.checked); break;
    case 'chkall': el.dataset.keys.split('|').forEach(k => { if (el.checked) state.checks[k] = true; else delete state.checks[k]; }); save(); renderLists(); break;
    case 'pname': { const p = state.people.find(x => x.id === el.dataset.id); if (p && el.value.trim()) { p.name = el.value.trim(); save(); renderHeader(); } break; }
    case 'vfield': {
      const v = state.vehicles.find(x => x.id === el.dataset.id), f = el.dataset.f; if (!v) break;
      if (f === 'name') { if (el.value.trim()) v.name = el.value.trim(); }
      else { const n = num(el.value); if (isNaN(n) || n < 0) delete v[f]; else v[f] = Math.round(n); if (f === 'odo0') v.odo0Ref = currentOdo() || 0; }
      save(); renderGroup(); renderHeader(); break;
    }
    case 'setting': saveSetting(el); break;
  }
});
function saveSetting(el) {
  const S = state.settings, k = el.dataset.key, v = el.type === 'checkbox' ? el.checked : el.value.trim();
  if (k === 'mode') { if (MODES[v]) state.mode = v; ensureVehicles(); save(); applyTheme(); refresh(); return toast('Modo da viagem atualizado.'); }
  if (k.startsWith('rate:')) { const n = num(v), c = k.slice(5); if (n > 0) S.rates[c] = n; else delete S.rates[c]; }
  else if (k === 'autonomy') { const n = num(v); S.autonomy = n > 0 ? n : 300; }
  else if (k === 'budget') { const n = num(v); S.budget = n > 0 ? n : 0; }
  else if (k === 'tripName') S.tripName = v || 'Diário de Bordo';
  else S[k] = v;
  save(); applyTheme(); renderHeader(); if (curView === 'group') renderGroup();
  toast('Configuração salva.');
}
$('photoInput').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; handlePhoto(f); });
window.addEventListener('online', renderHeader);
window.addEventListener('offline', renderHeader);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (curView === 'more') renderMore(); });
if (matchMedia('(prefers-color-scheme: light)').addEventListener) matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => applyTheme());
