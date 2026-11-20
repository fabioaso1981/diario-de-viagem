'use strict';
/* ===== Várias viagens ===== */
function resetUiForTrip() {
  Object.keys(expandedState).forEach(k => delete expandedState[k]);
  routeFilter = 'all'; finFilter = 'all'; curView = 'route';
}
function openTrips() {
  persist();
  openModal(`<h2>🧳 Suas viagens</h2>` + meta.trips.map(t => {
    const m = MODES[t.mode];
    return `<div class="cat"><div><b>${esc(t.name)}</b>${t.id === state.id ? ' <span class="tag">ABERTA</span>' : ''}<div class="small muted">${m ? m.icon + ' ' + esc(m.label) : ''}</div></div>
      <div class="row">${t.id !== state.id ? `<button class="btn sm" data-act="openTrip" data-id="${t.id}">Abrir</button>` : ''}${meta.trips.length > 1 ? `<button class="btn sm danger" data-act="delTrip" data-id="${t.id}">✕</button>` : ''}</div></div>`;
  }).join('') + btns(B('planner', '🧭 Novo roteiro', 'amber'), B('routes', '📚 Roteiros prontos', ''), B('closeModal', 'Fechar', 'ghost')));
}
async function openTripById(id) {
  persist();
  state = await readTrip(id);
  meta.active = id; persist();
  resetUiForTrip(); applyTheme(); closeModal();
  renderHeader(); renderView(); window.scrollTo(0, 0);
  toast(`Viagem aberta: ${state.settings.tripName}`);
  if (!state.setupDone) openSetup();
}
async function deleteTrip(id) {
  const t = meta.trips.find(x => x.id === id);
  if (!t || meta.trips.length < 2) return;
  if (!confirm(`Apagar a viagem "${t.name}" deste aparelho? Isso não pode ser desfeito (faça backup antes).`)) return;
  if (id === state.id) { const other = meta.trips.find(x => x.id !== id); await openTripById(other.id); }
  try {
    const s = await readTrip(id);
    if (idbOk && IDB.db) {
      for (const d of s.order) { try { (await IDB.photosOf(d)).forEach(p => IDB.del('photos', p.id)); } catch (e) { /* ok */ } }
      await IDB.del('kv', kvKey(id));
    }
    localStorage.removeItem(lsKey(id));
  } catch (e) { /* ok */ }
  meta.trips = meta.trips.filter(x => x.id !== id);
  persist(); openTrips();
}

/* ===== Planejador de novo roteiro ===== */
let plan = null;
const SPEED = { moto: 74, carro: 74, bike: 15 };
const hoursText = (km, mode) => { if (!SPEED[mode] || !(km > 0)) return '-'; const h = km / SPEED[mode]; return `${Math.floor(h)}h ${pad(Math.round((h % 1) * 60))}min`; };
const planRow = () => ({ city: '', km: '', stay: 0, tours: '' });

function openPlanner() {
  plan = { name: '', mode: state.mode, start: '', startDate: todayISO(), endDate: '', same: true, rows: [planRow()] };
  openModal(`<h2>🧭 Novo roteiro</h2>
    <p class="small muted" style="margin-bottom:8px">Informe o início, as paradas e o destino final. O app monta os dias (viagem + permanência com as atrações de cada lugar) e a rota no Google Maps.</p>
    <div class="fg"><label>Nome da viagem</label><input type="text" id="pl-name" placeholder="Ex.: Patagônia 2028"></div>
    <div class="fg"><label>Como será a viagem?</label><select id="pl-mode">${Object.keys(MODES).map(k => `<option value="${k}" ${plan.mode === k ? 'selected' : ''}>${MODES[k].icon} ${MODES[k].label}</option>`).join('')}</select></div>
    <div class="fgrid"><div class="fg"><label>📍 Local de início</label><input type="text" id="pl-start" placeholder="Goiânia-GO" data-inp="plsum"></div>
    <div class="fg"><label>Data de início</label><input type="date" id="pl-sdate" value="${plan.startDate}" data-chg="plsum"></div></div>
    <div class="sub">Paradas e destino final</div>
    <div id="pl-rows"></div>
    <button class="btn sm amber" data-act="plAdd">＋ Adicionar parada</button>
    <div class="fg" style="margin-top:10px"><label>Data final desejada (opcional)</label><input type="date" id="pl-edate" data-chg="plsum"></div>
    <label class="ck"><input type="checkbox" id="pl-same" checked> Usar o mesmo grupo (e veículos) desta viagem</label>
    <p class="small" id="pl-sum" style="color:var(--amber);font-weight:700"></p>
    ${btns(B('plCreate', 'Criar roteiro', 'ok'), B('closeModal', 'Cancelar', 'ghost'))}`);
  plRows();
}
function plRows() {
  const n = plan.rows.length;
  $('pl-rows').innerHTML = plan.rows.map((r, i) => {
    const city = r.city.trim(), last = i === n - 1;
    return `<div class="box"><div class="row between"><b>${last ? '🏁 Destino final' : 'Parada ' + (i + 1)}</b>${n > 1 ? `<button class="btn sm danger" data-act="plDel" data-i="${i}">✕</button>` : ''}</div>
      <div class="fgrid"><div class="fg"><label>Cidade</label><input type="text" id="pl-city-${i}" value="${esc(r.city)}" placeholder="Ushuaia" data-inp="plsum"></div>
      <div class="fg"><label>Km do trecho (opcional)</label><input type="text" inputmode="numeric" id="pl-km-${i}" value="${esc(r.km)}" placeholder="conferir no Maps"></div>
      <div class="fg"><label>Dias de permanência</label><input type="text" inputmode="numeric" id="pl-stay-${i}" value="${esc(r.stay)}" data-inp="plsum"></div>
      <div class="fg"><label>&nbsp;</label>${city ? `<a class="btn sm ghost" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('atrações turísticas em ' + city)}" target="_blank" rel="noopener">🔎 Ver atrações</a>` : '<span class="small muted">digite a cidade</span>'}</div></div>
      <div class="fg"><label>Atrações a visitar (uma por linha; "nome | custo")</label><textarea id="pl-tours-${i}" placeholder="Parque Nacional | USD 15">${esc(r.tours)}</textarea></div></div>`;
  }).join('');
  plSummary();
}
function plSync() {
  plan.name = $('pl-name').value.trim(); plan.mode = $('pl-mode').value; plan.start = $('pl-start').value.trim();
  plan.startDate = $('pl-sdate').value; plan.endDate = $('pl-edate').value; plan.same = $('pl-same').checked;
  plan.rows.forEach((r, i) => {
    r.city = $(`pl-city-${i}`).value; r.km = $(`pl-km-${i}`).value; r.stay = $(`pl-stay-${i}`).value; r.tours = $(`pl-tours-${i}`).value;
  });
}
function plSummary() {
  if (!$('pl-sum')) return;
  const rows = plan.rows.map((r, i) => ({ stay: Math.max(0, parseInt($(`pl-stay-${i}`) ? $(`pl-stay-${i}`).value : r.stay, 10) || 0) }));
  const days = rows.length + rows.reduce((a, r) => a + r.stay, 0), sd = $('pl-sdate').value;
  if (!sd) { $('pl-sum').textContent = ''; return; }
  const end = addDaysISO(sd, days - 1);
  let t = `${days} dias • de ${fmtShort(sd)} a ${fmtShort(end)}`;
  const ed = $('pl-edate').value;
  if (ed) { const d = diffDays(ed, end); t += d > 0 ? ` • sobram ${d} dia(s) até a data final: aumente a permanência` : d < 0 ? ` • passa ${-d} dia(s) da data final` : ' • encaixa na data final'; }
  $('pl-sum').textContent = t;
}
function plAddRow() { plSync(); plan.rows.splice(plan.rows.length - 1, 0, planRow()); plRows(); }
function plDelRow(i) { plSync(); plan.rows.splice(i, 1); plRows(); }

function buildTripFromPlan(p) {
  const lastCity = p.rows[p.rows.length - 1].city.trim();
  const st = defaultState(null, p.mode, p.name || `${p.start} → ${lastCity}`);
  st.setupDone = true; st.settings.deadline = p.endDate || '';
  if (p.same) {
    st.people = JSON.parse(JSON.stringify(state.people));
    if (MODES[p.mode].vehicle && MODES[state.mode].vehicle) st.vehicles = JSON.parse(JSON.stringify(state.vehicles));
    ['rates', 'theme', 'gloves', 'autonomy'].forEach(k => { st.settings[k] = JSON.parse(JSON.stringify(state.settings[k])); });
  }
  const add = (origin, dest, km, date, stage, hl, tours) => {
    const id = 'x' + uid();
    st.extra.push({ id, extra: true, stage, date, origin, dest, km, time: hoursText(km, p.mode), country: '', highlights: hl, gasWarning: false, tours: [], mapUrl: '' });
    st.order.push(id);
    if (tours && tours.length) st.days[id] = { tours };
    return id;
  };
  let cursor = p.startDate, prev = p.start;
  p.rows.forEach(r => {
    const city = r.city.trim(), km = Math.max(0, num(r.km) || 0), stay = Math.max(0, parseInt(r.stay, 10) || 0), tours = parseTours(r.tours), stage = `Rumo a ${city}`;
    add(prev, city, km, cursor, stage, `Trecho ${prev} → ${city}.${km ? ` ${nf(km)} km.` : ''}${r.note ? ' ' + r.note : ''} Veja a rota no botão "Mapa".`, stay === 0 ? tours : []);
    cursor = addDaysISO(cursor, 1);
    for (let k = 0; k < stay; k++) {
      add(city, city, 0, cursor, stage, `Dia de permanência em ${city}: aproveite as atrações.`, tours.filter((_, idx) => idx % stay === k));
      cursor = addDaysISO(cursor, 1);
    }
    prev = city;
  });
  return st;
}
function copyGroupInto(st) {
  st.people = JSON.parse(JSON.stringify(state.people));
  if (MODES[st.mode].vehicle && MODES[state.mode].vehicle) st.vehicles = JSON.parse(JSON.stringify(state.vehicles));
  ['rates', 'theme', 'gloves', 'autonomy'].forEach(k => { st.settings[k] = JSON.parse(JSON.stringify(state.settings[k])); });
}
/* Remove uma viagem vazia (ex.: a viagem em branco do primeiro uso) quando outra a substitui */
async function dropTripData(id) {
  meta.trips = meta.trips.filter(x => x.id !== id);
  try { if (idbOk && IDB.db) await IDB.del('kv', kvKey(id)); } catch (e) { /* ok */ }
  try { localStorage.removeItem(lsKey(id)); } catch (e) { /* ok */ }
}
async function activateTrip(st) {
  const prev = state;
  persist();
  state = st; ensureVehicles(); meta.active = st.id;
  if (prev && prev.id !== st.id && isEmptyTrip(prev)) await dropTripData(prev.id);
  persist();
  resetUiForTrip(); applyTheme(); closeModal();
  renderHeader(); renderView(); window.scrollTo(0, 0);
}
async function plCreate() {
  plSync();
  if (!canCreateTrip()) return openPaywall('trips');
  if (!plan.start) return toast('Informe o local de início.');
  if (!plan.startDate) return toast('Informe a data de início.');
  if (plan.rows.some(r => !r.city.trim())) return toast('Preencha a cidade de todas as paradas.');
  const st = buildTripFromPlan(plan);
  await activateTrip(st);
  toast(`Roteiro criado: ${st.order.length} dias. Use "🗺️ Rota completa" para ver no Google Maps.`);
}

/* ===== Replanejar o roteiro (novo caminho até o destino final) ===== */
let rp = null;
function hasDayData(id) {
  const o = state.days[id] || {};
  return state.expenses.some(e => e.dayId === id) || isNum(o.odoStart) || isNum(o.odoEnd) || isNum(o.kmManual) || !!(o.log && o.log.length)
    || !!(o.hotel && Object.values(o.hotel).some(Boolean)) || !!(o.status && o.status !== 'pending');
}
const replaceable = id => !hasDayData(id);
function replanSeed(fromId) {
  const vo = visibleOrder(), cand = vo.slice(vo.indexOf(fromId)).filter(replaceable);
  if (!cand.length) return null;
  return { fromId, origin: getDay(cand[0]).origin, rows: cand.map(id => { const d = getDay(id); return { src: id, date: d.date, dest: d.dest, km: d.km || 0 }; }) };
}
function openReplan(fromId) {
  const vo = visibleOrder();
  if (!vo.length) return toast('Este roteiro ainda não tem dias.');
  const opts = vo.filter(replaceable);
  if (!opts.length) return toast('Não há dias pendentes para replanejar.');
  const start = fromId && opts.includes(fromId) ? fromId : (opts.includes(currentDayId()) ? currentDayId() : opts[0]);
  rp = replanSeed(start);
  openModal(`<h2>🔀 Replanejar roteiro</h2>
    <p class="small muted" style="margin-bottom:8px">Defina o novo caminho até o destino final, dia a dia. Os dias pendentes a partir do escolhido são substituídos; o que já tem registro continua como está.</p>
    <div class="fg"><label>Replanejar a partir do dia</label><select id="rp-from" data-chg="rpFrom">${opts.map(id => `<option value="${id}" ${id === start ? 'selected' : ''}>Dia ${dayNumber(id)} — ${esc(getDay(id).dest)}</option>`).join('')}</select></div>
    <div class="fg"><label>📍 Saindo de</label><input type="text" id="rp-origin" value="${esc(rp.origin)}" data-inp="rpsum"></div>
    <div id="rp-rows"></div>
    <button class="btn sm amber" data-act="rpAdd">＋ Adicionar dia</button>
    <p class="small muted" style="margin-top:8px">O último dia é o destino final. Para saber os km de cada dia, abra o trecho no Google Maps (botão 🗺️) e digite aqui.</p>
    ${btns(B('rpSave', 'Salvar novo roteiro', 'ok'), B('closeModal', 'Cancelar', 'ghost'))}`);
  rpRows();
}
function rpRows() {
  let prev = rp.origin;
  $('rp-rows').innerHTML = rp.rows.map((r, i) => {
    const html = `<div class="box"><div class="row between"><b>${i === rp.rows.length - 1 ? '🏁 Dia final' : 'Dia ' + (i + 1)}</b><span class="small muted">de ${esc(prev || '?')}</span>
      ${rp.rows.length > 1 ? `<button class="btn sm danger" data-act="rpDel" data-i="${i}">✕</button>` : ''}</div>
      <div class="fgrid"><div class="fg"><label>Data</label><input type="date" id="rp-date-${i}" value="${r.date}"></div>
      <div class="fg"><label>Km previstos</label><input type="text" inputmode="numeric" id="rp-km-${i}" value="${r.km || ''}"></div></div>
      <div class="fg"><label>Destino (cidade onde vai dormir)</label><input type="text" id="rp-dest-${i}" value="${esc(r.dest)}" data-inp="rpsum"></div></div>`;
    prev = r.dest;
    return html;
  }).join('');
}
function rpSync() {
  rp.origin = $('rp-origin').value.trim();
  rp.rows.forEach((r, i) => { r.date = $(`rp-date-${i}`).value || r.date; r.km = num($(`rp-km-${i}`).value) || 0; r.dest = $(`rp-dest-${i}`).value.trim(); });
}
function rpAddRow() { rpSync(); const l = rp.rows[rp.rows.length - 1]; rp.rows.push({ src: null, date: l ? addDaysISO(l.date, 1) : todayISO(), dest: '', km: 0 }); rpRows(); }
function rpDelRow(i) { rpSync(); rp.rows.splice(i, 1); rpRows(); }
function rpChangeFrom(id) { const s = replanSeed(id); if (s) { rp = s; $('rp-origin').value = rp.origin; rpRows(); } }
function rpSave() {
  rpSync();
  if (!rp.rows.length) return toast('Inclua ao menos um dia.');
  if (!rp.origin) return toast('Informe de onde você sai.');
  if (rp.rows.some(r => !r.dest)) return toast('Informe o destino de todos os dias.');
  const vo = visibleOrder(), cand = vo.slice(vo.indexOf(rp.fromId)).filter(replaceable);
  const first = getDay(cand[0]), prevOrder = [...state.order], insertAt = state.order.indexOf(cand[0]), added = [];
  let prev = rp.origin;
  rp.rows.forEach(r => {
    const id = 'x' + uid(), src = r.src ? getDay(r.src) : null, same = !!(src && src.dest === r.dest);
    state.extra.push({ id, extra: true, stage: src ? src.stage : first.stage || 'Roteiro replanejado', date: r.date, origin: prev, dest: r.dest, km: r.km,
      time: same ? src.time : hoursText(r.km, state.mode), country: same ? src.country : '', highlights: same ? src.highlights : 'Trecho do roteiro replanejado.',
      gasWarning: same ? src.gasWarning : false, tours: [], mapUrl: same && prev === src.origin ? (src.base.mapUrl || '') : '' });
    if (same && src.tours.length) state.days[id] = { tours: JSON.parse(JSON.stringify(src.tours)) };
    added.push(id); prev = r.dest;
  });
  cand.forEach(id => { ovr(id).replaced = true; });
  state.order.splice(insertAt, 0, ...added);
  state.replans.push({ ts: Date.now(), removed: cand, added, prevOrder });
  save(); closeModal(); refresh();
  toast(`Novo roteiro salvo: ${added.length} dia(s) até ${prev}.`);
}
function undoReplan() {
  const r = state.replans[state.replans.length - 1];
  if (!r) return;
  if (r.added.some(id => hasDayData(id))) return toast('Já há registros nos dias novos: não dá para desfazer automaticamente.');
  if (!confirm('Desfazer o último replanejamento e voltar aos dias anteriores?')) return;
  r.removed.forEach(id => { if (state.days[id]) delete state.days[id].replaced; });
  state.extra = state.extra.filter(x => !r.added.includes(x.id));
  r.added.forEach(id => { delete state.days[id]; });
  state.order = state.order.filter(id => !r.added.includes(id));
  state.replans.pop();
  save(); closeModal(); refresh(); toast('Replanejamento desfeito.');
}
