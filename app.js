'use strict';
/* ===== Estado de interface ===== */
let curView = 'route', routeFilter = 'all', finFilter = 'all', dashOpen = false;
const expandedState = {}, scrollByView = {}, photoUrls = {};
let toastFn = null, toastT = null, modalOpen = false, modalDirty = false, photoDay = null, pendingImport = null, sosText = '', deferredInstall = null;

/* ===== Tema / toast / modal ===== */
function applyTheme() {
  const t = state.settings.theme;
  const eff = t === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t;
  document.documentElement.setAttribute('data-theme', eff);
  document.body.classList.toggle('gloves', !!state.settings.gloves);
}
function toast(msg, label, fn) {
  const t = $('toast');
  t.innerHTML = `<span>${esc(msg)}</span>` + (label ? `<button data-act="toastAct">${esc(label)}</button>` : '');
  toastFn = fn || null;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), label ? 8000 : 2800);
}
function openModal(html) {
  $('sheet').innerHTML = html;
  $('modal').classList.remove('hidden');
  $('sheet').scrollTop = 0;
  modalDirty = false;
  if (!modalOpen) { try { history.pushState({ m: 1 }, ''); } catch (e) { /* ok */ } }
  modalOpen = true;
}
function closeModal(fromPop) {
  if (!modalOpen) return;
  $('modal').classList.add('hidden');
  $('sheet').innerHTML = '';
  modalOpen = false; modalDirty = false;
  if (!fromPop && history.state && history.state.m) history.back();
}
window.addEventListener('popstate', () => { if (modalOpen) closeModal(true); });
const btns = (...b) => `<div class="btnrow">${b.join('')}</div>`;
const B = (act, label, cls = '', extra = '') => `<button class="btn ${cls}" data-act="${act}" ${extra}>${label}</button>`;

/* ===== Cabeçalho / painel ===== */
function renderHeader() {
  const st = tripStats(), n = activePeople().length, M = modeOf();
  $('badge').textContent = `${M.icon} ${n} ${n === 1 ? M.noun : M.nouns} • ${tripYear()}`;
  $('trip-title').textContent = state.settings.tripName + ' ▾';
  $('pl-left').textContent = `${st.nDone} de ${st.act.length} dias concluídos`;
  $('pl-right').textContent = `${nf(st.done)} / ${nf(st.total)} km (${st.pct}%)`;
  $('fill').style.width = st.pct + '%';
  $('net').textContent = navigator.onLine ? '● online' : '○ offline';
  $('dash-btn').textContent = dashOpen ? 'Painel ▴' : 'Painel ▾';
  $('dash').classList.toggle('hidden', !dashOpen);
  if (dashOpen) $('dash').innerHTML = dashHTML(st);
  document.documentElement.style.setProperty('--hdr', $('hdr').offsetHeight + 'px');
}
function dashHTML(st) {
  const exps = state.expenses, total = sumBRL(exps), n = activePeople().length || 1, S = state.settings, M = modeOf();
  const c = [];
  c.push(`<div class="dash-card"><span class="dl">${M.icon} Percorrido</span><span class="dv">${nf(st.done)} km</span><span class="ds">faltam ${nf(st.remaining)} km</span></div>`);
  const slack = st.slack;
  c.push(`<div class="dash-card"><span class="dl">📅 Chegada prevista</span><span class="dv ${slack != null && slack < 0 ? 'bad' : ''}">${st.arrival ? fmtShort(st.arrival) : '--'}</span><span class="ds">${slack != null ? (slack >= 0 ? `folga de ${slack} d` : `${-slack} d além do limite`) : (st.pace ? `ritmo real ${nf(st.pace)} km/dia` : 'defina a data limite em Mais')}</span></div>`);
  c.push(`<div class="dash-card"><span class="dl">💰 Gasto total</span><span class="dv">${BRL(total)}</span><span class="ds">${BRL(total / n)} por pessoa${S.budget > 0 ? ` • ${Math.round(total / S.budget * 100)}% do orçamento` : ''}</span></div>`);
  if (vehiclesOn()) {
    const fs = fuelStats(), kml = fs.l > 0 ? fs.km / fs.l : null, lf = lastFuelInfo();
    c.push(`<div class="dash-card"><span class="dl">⛽ Média</span><span class="dv">${kml ? nf(kml, 1) + ' km/L' : '-- km/L'}</span><span class="ds">${kml ? `${nf(fs.km)} km / ${nf(fs.l, 1)} L` : 'abasteça com tanque cheio'}</span></div>`);
    if (lf) {
      const low = lf.left < 100;
      c.push(`<div class="dash-card wide"><span class="dl">⛽ Autonomia (desde o último abastecimento)</span><span class="dv ${low ? 'bad' : ''}">≈ ${nf(Math.max(0, lf.left))} km restantes</span><span class="ds">rodou ${nf(lf.since)} km • autonomia configurada ${nf(S.autonomy)} km (com galão)</span></div>`);
    }
    oilAlerts().forEach(a => c.push(`<div class="dash-card wide"><span class="dl">🔧 Óleo e filtro — ${esc(a.v.name)}</span><span class="dv bad">${a.level === 'overdue' ? `VENCIDA há ${nf(-a.left)} km` : `troca em ${nf(a.left)} km`}</span><span class="ds">${a.at ? `limite por volta do Dia ${dayNumber(a.at.id)} (${esc(a.at.dest)})` : 'procure uma oficina'}</span></div>`));
  }
  const cat = {}; Object.keys(CATS).forEach(k => cat[k] = 0);
  exps.forEach(e => { if (cat[e.category] != null) cat[e.category] += e.brl || 0; });
  if (total > 0) {
    c.push(`<div class="dash-card wide"><div class="stack">${Object.keys(CATS).filter(k => cat[k] > 0).map(k => `<i style="width:${cat[k] / total * 100}%;background:${CATS[k].color}"></i>`).join('')}</div>
      <span class="ds">${Object.keys(CATS).filter(k => cat[k] > 0).map(k => `${CATS[k].icon} ${Math.round(cat[k] / total * 100)}%`).join(' &nbsp; ')}</span></div>`);
  }
  return c.join('');
}

/* ===== Roteiro ===== */
function hasData() {
  return state.expenses.length > 0 || Object.values(state.days).some(o => o.status || isNum(o.odoEnd) || (o.log && o.log.length));
}
function backupBanner() {
  const last = state.settings.lastBackup, old = !last || Date.now() - last > 3 * 86400000;
  if (!hasData() || !old) return '';
  return `<div class="banner">💾 ${last ? 'Último backup há ' + Math.floor((Date.now() - last) / 86400000) + ' dias.' : 'Você ainda não fez backup.'} Salve um arquivo (ou envie pelo WhatsApp) quando tiver sinal.
    <div class="btnrow"><button class="btn amber sm" data-act="exportFile">Fazer backup agora</button></div></div>`;
}
function oilShopLink(a) {
  const d = getDay(currentDayId() || '') || (a.at || null);
  const city = d ? d.dest : '';
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`oficina troca de óleo ${modeOf().vname.toLowerCase()} ${city}`);
}
function oilBanner() {
  return oilAlerts().map(a => `<div class="banner" style="border-color:var(--danger)">🔧 <b>${esc(a.v.name)}</b>: ${a.level === 'overdue'
    ? `troca de óleo e filtro <b>vencida</b> (passou ${nf(-a.left)} km)`
    : `troca de óleo e filtro em <b>${nf(a.left)} km</b>${a.at ? ` (por volta do Dia ${dayNumber(a.at.id)} — ${esc(a.at.dest)})` : ''}`}. Procure uma oficina.
    <div class="btnrow"><a class="btn sm amber" href="${oilShopLink(a)}" target="_blank" rel="noopener">🗺️ Oficinas no destino</a><button class="btn sm ghost" data-act="oilDone" data-id="${a.v.id}">Já troquei</button></div></div>`).join('');
}
const isOpenDay = (id, curId) => expandedState[id] !== undefined ? expandedState[id] : id === curId;
function odoLine(d) {
  if (d.odoStart != null || d.odoEnd != null) return `🔢 Odômetro: ${d.odoStart != null ? nf(d.odoStart) : '—'}${d.odoStartInherited ? ' <span class="muted">(do dia anterior)</span>' : ''} → ${d.odoEnd != null ? nf(d.odoEnd) : '—'}`;
  if (d.kmManual != null) return `🔢 ${nf(d.kmManual)} km no dia`;
  return '🔢 Odômetro: —';
}

function dayHTML(d, curId, fs) {
  const isCur = d.id === curId, open = isOpenDay(d.id, curId), exps = dayExpenses(d.id), cost = sumBRL(exps), veh = vehiclesOn();
  const rk = realKm(d), today = d.date === todayISO(), diff = diffDays(d.date, d.planDate);
  let dkm = 0, dl = 0;
  exps.forEach(e => { const s = fs.perEntry[e.id]; if (s) { dkm += s.km; dl += s.l; } });
  const pills = [];
  if (d.km > 0) pills.push(`<span class="pill">📏 ${nf(d.km)} km</span>`);
  if (rk != null) pills.push(`<span class="pill good">${modeOf().icon} ${nf(rk)} km reais${d.km > 0 ? ` (${rk - d.km >= 0 ? '+' : ''}${nf(rk - d.km)})` : ''}</span>`);
  if (d.time !== '-') pills.push(`<span class="pill">⏱️ ${esc(d.time)}</span>`);
  if (d.country) pills.push(`<span class="pill">${esc(d.country)}</span>`);
  if (cost > 0) pills.push(`<span class="pill cost">💰 ${BRL(cost)}</span>`);
  if (dl > 0) pills.push(`<span class="pill fuel">⛽ ${nf(dkm / dl, 1)} km/L</span>`);
  pills.push(`<a class="pill" href="${esc(mapLink(d))}" target="_blank" rel="noopener">🗺️ Mapa</a>`);
  if (!d.km && d.dest) pills.push(`<a class="pill" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('atrações turísticas em ' + d.dest)}" target="_blank" rel="noopener">🔎 Atrações</a>`);
  const title = d.origin === d.dest ? `📍 ${esc(d.dest)}` : `${esc(d.origin)} → ${esc(d.dest)}`;

  let h = `<section class="card day ${d.status} ${isCur ? 'cur' : ''}" id="day-${d.id}">
    <div class="day-badge">DIA ${dayNumber(d.id)} • ${fmtDate(d.date)}
      ${isCur ? '<span class="tag">ATUAL</span>' : ''}${today ? '<span class="tag">HOJE</span>' : ''}
      ${diff !== 0 ? `<span class="tag alt">${diff > 0 ? '+' : ''}${diff} d vs plano</span>` : ''}${d.isExtra && state.template === 'ushuaia' ? '<span class="tag alt">EXTRA</span>' : ''}${d.changedRoute ? '<span class="tag alt">trecho alterado</span>' : ''}</div>
    <div class="route-title">${title}</div>
    <div class="metrics">${pills.join('')}</div>
    <div class="seg">${['pending', 'doing', 'done', 'skipped'].map(s =>
      `<button data-act="status" data-id="${d.id}" data-st="${s}" class="${d.status === s ? 'on' : ''}">${STATUS[s]}</button>`).join('')}</div>`;

  if (open) {
    const lf = lastFuelInfo();
    if (d.gasWarning && veh) h += `<div class="gas">🚨 COMBUSTÍVEL: galão extra cheio! Postos escassos neste trecho.${lf ? ` Autonomia restante ≈ ${nf(Math.max(0, lf.left))} km.` : ''}</div>`;
    if (d.highlights) h += `<div class="hl"><strong>Observações:</strong> ${esc(d.highlights)}</div>`;
    const ho = d.hotel;
    if (ho.name || ho.addr || ho.phone || ho.conf) {
      const q = ho.coords || ho.addr || ho.name;
      h += `<div class="hotel"><strong>🏨 ${esc(ho.name || 'Hospedagem')}</strong>
        ${ho.addr ? `<div>${esc(ho.addr)}</div>` : ''}
        <div class="row wrap">${ho.phone ? `<a href="tel:${esc(ho.phone.replace(/[^\d+]/g, ''))}">📞 ${esc(ho.phone)}</a>` : ''}
        ${q ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}" target="_blank" rel="noopener">🗺️ Abrir no mapa</a>` : ''}</div>
        ${ho.coords ? `<div class="small muted">📍 ${esc(ho.coords)}</div>` : ''}
        ${ho.conf ? `<div class="small">Reserva: <strong>${esc(ho.conf)}</strong></div>` : ''}
        ${ho.checkin ? `<div class="small">Check-in: ${esc(ho.checkin)}</div>` : ''}</div>`;
    }
    h += `<div class="box"><div class="row between"><span class="small">${odoLine(d)}</span>
        <button class="btn sm ghost" data-act="odo" data-id="${d.id}">Registrar</button></div></div>`;
    if (d.tours.length) {
      h += `<div class="box"><div class="sub">📌 Pontos turísticos & gastos planejados</div>` + d.tours.map((t, i) => {
        const k = `t:${d.id}:${i}`, on = !!state.checks[k];
        return `<div class="tour ${on ? 'dn' : ''}"><label><input type="checkbox" data-chg="tour" data-key="${k}" ${on ? 'checked' : ''}><span>${esc(t.name)}</span></label><span class="c">${esc(t.cost)}</span></div>`;
      }).join('') + `</div>`;
    }
    if (exps.length) {
      h += `<div class="sub">Despesas</div>` + exps.map(e => {
        const c = CATS[e.category] || CATS.outros, s = fs.perEntry[e.id];
        const meta = [e.desc, e.paidBy ? 'pago por ' + pName(e.paidBy) : '', s ? `${nf(s.km)} km • ${nf(s.l, 1)} L (${nf(s.km / s.l, 1)} km/L)` : (e.liters ? nf(e.liters, 1) + ' L' : '')].filter(Boolean).join(' • ');
        return `<button class="item" data-act="openExp" data-id="${e.id}"><span class="l"><span class="t" style="color:${c.color}">${c.icon} ${c.label}</span>${meta ? `<span class="m">${esc(meta)}</span>` : ''}</span>
          <span class="a">${BRL(e.brl)}${e.currency !== 'BRL' ? `<div class="m small muted">${fmtCur(e.amount, e.currency)}</div>` : ''}</span></button>`;
      }).join('');
    }
    h += `<div class="photos" data-photos="${d.id}"></div>`;
    if (d.log.length) {
      h += `<div class="sub">Diário</div>` + [...d.log].sort((a, b) => a.ts - b.ts).map(l =>
        `<button class="item" data-act="note" data-day="${d.id}" data-id="${l.id}"><span class="l"><span class="m">${fmtTime(l.ts)}${l.weather ? ' • ' + l.weather : ''}${isNum(l.temp) ? ' ' + l.temp + '°C' : ''}</span><span class="t" style="font-weight:500;white-space:pre-wrap">${esc(l.text)}</span></span></button>`).join('');
    }
    h += `<div class="actions">
      <button class="btn amber" data-act="openExp" data-day="${d.id}" data-cat="${veh ? 'abastecimento' : 'passagens'}">${veh ? '⛽ Abastecer' : '🎫 Passagem'}</button>
      <button class="btn amber" data-act="openExp" data-day="${d.id}">💰 Gasto</button>
      <button class="btn ghost" data-act="odo" data-id="${d.id}">🔢 ${veh || state.mode === 'bike' ? 'Odômetro' : 'Distância'}</button>
      <button class="btn ghost" data-act="note" data-day="${d.id}">📝 Anotar</button>
      <button class="btn ghost" data-act="photo" data-id="${d.id}">📷 Foto</button>
      <button class="btn ghost" data-act="editDay" data-id="${d.id}">✏️ Editar</button></div>`;
  }
  h += `<button class="more-toggle" data-act="expand" data-id="${d.id}">${open ? 'Recolher ▴' : 'Detalhes ▾'}</button></section>`;
  return h;
}

function tripMapsLink() {
  const days = orderedDays().filter(d => d.status !== 'skipped');
  if (!days.length) return '';
  const origin = days[0].origin, dest = days[days.length - 1].dest;
  const stops = []; days.slice(0, -1).forEach(d => { if (d.dest !== dest && d.dest !== origin && !stops.includes(d.dest)) stops.push(d.dest); });
  const way = stops.length > 9 ? stops.filter((_, i) => i % Math.ceil(stops.length / 9) === 0).slice(0, 9) : stops;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}${way.length ? '&waypoints=' + encodeURIComponent(way.join('|')) : ''}&travelmode=${modeOf().travel}`;
}

function renderRoute() {
  const curId = currentDayId(), fs = fuelStats();
  let days = orderedDays();
  if (routeFilter === 'pending') days = days.filter(d => d.status === 'pending' || d.status === 'doing');
  if (routeFilter === 'cur') days = days.filter(d => d.id === curId);
  const mapsUrl = tripMapsLink();
  let h = backupBanner() + oilBanner() + `<div class="chips">
    ${[['all', 'Todos'], ['pending', 'Pendentes'], ['cur', 'Atual']].map(([f, l]) => `<button class="chip ${routeFilter === f ? 'on' : ''}" data-act="filter" data-f="${f}">${l}</button>`).join('')}
    <button class="chip" data-act="goCur">📍 Ir ao atual</button>
    <button class="chip" data-act="adjust">⚙️ Ajustar roteiro</button>
    <button class="chip" data-act="replan">🔀 Replanejar</button>
    ${mapsUrl ? `<a class="chip" href="${esc(mapsUrl)}" target="_blank" rel="noopener">🗺️ Rota completa</a>` : ''}</div>`;
  if (!state.order.length) h += `<div class="card" style="text-align:center"><h3>Este roteiro ainda não tem dias</h3><div class="btnrow"><button class="btn amber" data-act="addFirstDay">➕ Adicionar primeiro dia</button><button class="btn" data-act="planner">🧭 Criar roteiro novo</button><button class="btn" data-act="routes">📚 Roteiros prontos</button></div></div>`;
  else if (!days.length) h += `<div class="card" style="text-align:center"><h3>${routeFilter === 'pending' ? 'Nada pendente 🎉' : 'Nada para mostrar'}</h3><p class="muted small">${routeFilter === 'pending' ? 'Roteiro concluído! Parabéns pela viagem.' : ''}</p></div>`;
  let last = null;
  days.forEach(d => {
    if (d.stage !== last) { if (d.stage) h += `<div class="stage">${esc(d.stage)}</div>`; last = d.stage; }
    h += dayHTML(d, curId, fs);
  });
  $('view').innerHTML = h;
  hydratePhotos($('view'));
}

async function hydratePhotos(root) {
  if (!idbOk) return;
  root.querySelectorAll('[data-photos]').forEach(async el => {
    try {
      const arr = await IDB.photosOf(el.dataset.photos);
      arr.sort((a, b) => a.ts - b.ts);
      el.innerHTML = arr.map(p => {
        if (!photoUrls[p.id]) photoUrls[p.id] = URL.createObjectURL(p.blob);
        return `<img data-act="viewPhoto" data-id="${p.id}" src="${photoUrls[p.id]}" alt="foto">`;
      }).join('');
    } catch (e) { /* sem fotos */ }
  });
}

/* ===== Gastos ===== */
function expItemHTML(e) {
  const c = CATS[e.category] || CATS.outros, d = getDay(e.dayId);
  const meta = [d ? `Dia ${dayNumber(e.dayId)}` : '', fmtDT(e.ts), e.desc, e.paidBy ? 'pago por ' + pName(e.paidBy) : ''].filter(Boolean).join(' • ');
  return `<button class="item" data-act="openExp" data-id="${e.id}"><span class="l"><span class="t" style="color:${c.color}">${c.icon} ${c.label}</span><span class="m">${esc(meta)}</span></span>
    <span class="a">${BRL(e.brl)}${e.currency !== 'BRL' ? `<div class="m small muted">${fmtCur(e.amount, e.currency)}</div>` : ''}</span></button>`;
}
function consumptionHint() {
  const fuels = state.expenses.filter(e => e.category === 'abastecimento');
  if (!fuels.length) return 'Registre os abastecimentos com odômetro e "tanque cheio": o km/L de cada trecho é calculado a cada novo abastecimento.';
  const withOdo = fuels.filter(e => e.odo > 0);
  if (fuels.length === 1) return 'Primeiro abastecimento registrado: ele serve de base. O consumo aparece a partir do próximo com tanque cheio.';
  if (withOdo.length < 2) return 'Falta o odômetro em algum abastecimento (ou o campo "km desde o último"). Edite o lançamento e preencha.';
  if (new Set(withOdo.map(e => e.odo)).size < 2) return 'Os abastecimentos estão com o mesmo odômetro. O odômetro precisa aumentar de um abastecimento para o outro.';
  if (fuels.filter(e => e.full).length < 2) return 'Marque "tanque cheio" nos abastecimentos: o método precisa de dois tanques cheios para calcular o trecho.';
  return 'Ainda não há dois abastecimentos do mesmo veículo com tanque cheio e odômetros diferentes.';
}
function renderFinance() {
  const exps = state.expenses, total = sumBRL(exps), people = activePeople(), n = people.length || 1, S = state.settings;
  const cat = {}; Object.keys(CATS).forEach(k => cat[k] = 0);
  exps.forEach(e => { if (cat[e.category] != null) cat[e.category] += e.brl || 0; });
  let h = `<div class="stage">Resumo</div><div class="card">
    <div class="row between"><div><div class="muted small">Total gasto (${exps.length} lançamentos)</div><div style="font-size:1.5rem;font-weight:800;color:var(--amber)">${BRL(total)}</div></div>
    <div class="right"><div class="muted small">por pessoa (${n})</div><b>${BRL(total / n)}</b></div></div>
    ${S.budget > 0 ? `<div class="bar" style="height:8px;margin-top:8px"><i style="width:${Math.min(100, total / S.budget * 100)}%;background:${total > S.budget ? 'var(--danger)' : 'var(--ok)'}"></i></div>
      <div class="small muted">Orçamento ${BRL(S.budget)} • ${total > S.budget ? 'estourado em ' + BRL(total - S.budget) : 'restam ' + BRL(S.budget - total)}</div>` : '<div class="small muted" style="margin-top:6px">Defina um orçamento total em Mais ▸ Configurações.</div>'}
  </div>`;

  h += `<div class="stage">Por categoria</div><div class="card">` + Object.keys(CATS).map(k => {
    const p = total > 0 ? cat[k] / total * 100 : 0;
    return `<div class="cat"><div class="grow"><span class="dot" style="background:${CATS[k].color}"></span> ${CATS[k].icon} ${CATS[k].label}<div class="bar"><i style="width:${p}%;background:${CATS[k].color}"></i></div></div>
      <div class="right"><b>${BRL(cat[k])}</b><div class="small muted">${nf(p, 1)}%</div></div></div>`;
  }).join('') + `</div>`;

  const cur = {};
  exps.forEach(e => { if (e.currency !== 'BRL') cur[e.currency] = (cur[e.currency] || 0) + e.amount; });
  if (Object.keys(cur).length) h += `<div class="stage">Por moeda original</div><div class="card">` + Object.entries(cur).map(([c, v]) => `<div class="cat"><span>${c}</span><b>${fmtCur(v, c)}</b></div>`).join('') + `</div>`;

  const bal = balances(), sets = settlements(bal);
  h += `<div class="stage">Divisão entre o grupo</div><div class="card">`;
  const shown = state.people.filter(p => p.active !== false || bal[p.id].paid > 0 || bal[p.id].share > 0);
  if (!shown.length) h += `<p class="muted small">Cadastre os integrantes na aba Grupo.</p>`;
  h += shown.map(p => {
    const v = bal[p.id], net = v.paid - v.share;
    return `<div class="cat"><div><b>${esc(p.name)}${p.active === false ? ' (fora)' : ''}</b><div class="small muted">pagou ${BRL(v.paid)} • consumiu ${BRL(v.share)}</div></div>
      <b class="${net > 0.5 ? 'pos' : net < -0.5 ? 'neg' : ''}">${net > 0.5 ? 'recebe ' : net < -0.5 ? 'deve ' : ''}${BRL(Math.abs(net))}</b></div>`;
  }).join('');
  if (sets.length) h += `<div class="sub" style="margin-top:8px">Para zerar as contas</div>` + sets.map(s => `<div class="cat"><span>${esc(pName(s.from))} → ${esc(pName(s.to))}</span><b>${BRL(s.v)}</b></div>`).join('');
  else if (shown.length) h += `<p class="small muted" style="margin-top:6px">Tudo certo: ninguém deve nada (considerando só gastos com "Pago por" preenchido).</p>`;
  h += `</div>`;

  if (vehiclesOn()) {
    const fs = fuelStats();
    h += `<div class="stage">Consumo de combustível</div><div class="card">`;
    if (fs.l > 0) {
      h += `<div class="cat"><b>Média geral</b><b style="color:var(--amber)">${nf(fs.km / fs.l, 1)} km/L</b></div>`;
      Object.entries(fs.byWho).forEach(([k, v]) => { h += `<div class="cat"><span>${k === '_' ? 'Sem veículo definido' : esc(vName(k))}</span><span>${nf(v.km / v.l, 1)} km/L <span class="small muted">(${nf(v.km)} km / ${nf(v.l, 1)} L)</span></span></div>`; });
    } else h += `<p class="muted small">${consumptionHint()}</p>`;
    const fuels = exps.filter(e => e.category === 'abastecimento').sort((a, b) => b.ts - a.ts);
    if (fuels.length) {
      h += `<div class="sub" style="margin-top:8px">Abastecimentos</div>` + fuels.map(e => {
        const s = fs.perEntry[e.id], d = getDay(e.dayId);
        const meta = [d ? `Dia ${dayNumber(e.dayId)}` : '', fmtDT(e.ts), e.who ? vName(e.who) : '', e.odo ? 'odô ' + nf(e.odo) : '', e.liters ? nf(e.liters, 1) + ' L' : '', e.liters > 0 ? BRL(e.brl / e.liters) + '/L' : '', e.full ? '' : 'parcial'].filter(Boolean).join(' • ');
        return `<button class="item" data-act="openExp" data-id="${e.id}"><span class="l"><span class="t">${esc(e.desc || 'Abastecimento')}</span><span class="m">${esc(meta)}</span>${s ? `<span class="m" style="color:var(--amber)">${nf(s.km)} km → ${nf(s.km / s.l, 1)} km/L</span>` : ''}</span><span class="a">${BRL(e.brl)}</span></button>`;
      }).join('');
    }
    h += `</div>`;
  }

  const pt = plannedToursUSD(), usd = S.rates.USD;
  if (pt.max > 0) h += `<div class="stage">Passeios: planejado × gasto</div><div class="card">
    <div class="cat"><span>Planejado (roteiro)</span><b>USD ${pt.min} – ${pt.max}${usd ? ` <span class="small muted">≈ ${BRL(pt.min * usd)} – ${BRL(pt.max * usd)}</span>` : ''}</b></div>
    <div class="cat"><span>Gasto em passeios</span><b>${BRL(cat.passeios)}</b></div>
    ${usd ? '' : '<p class="small muted">Informe a cotação do USD em Mais ▸ Configurações para ver em reais.</p>'}</div>`;

  const list = exps.filter(e => finFilter === 'all' || e.category === finFilter).sort((a, b) => b.ts - a.ts);
  h += `<div class="stage">Histórico</div><div class="chips"><button class="chip ${finFilter === 'all' ? 'on' : ''}" data-act="finFilter" data-f="all">Todas</button>` +
    Object.keys(CATS).map(k => `<button class="chip ${finFilter === k ? 'on' : ''}" data-act="finFilter" data-f="${k}">${CATS[k].icon}</button>`).join('') + `</div>`;
  h += list.length ? list.map(expItemHTML).join('') : `<p class="muted small">Nenhum lançamento. Toque no <b>+</b> para registrar.</p>`;
  $('view').innerHTML = h;
}

/* ===== Listas ===== */
function itemKeys(list, it) {
  const ppl = activePeople();
  if (list.perPerson && ppl.length) return ppl.map(p => `${list.id}:${it.id}:${p.id}`);
  return [`${list.id}:${it.id}`];
}
function renderLists() {
  const ppl = activePeople();
  let h = '';
  activeLists().forEach(list => {
    const items = [...list.items, ...((state.customItems[list.id]) || []).map(c => ({ id: c.id, t: esc(c.t), custom: true }))];
    const doneN = items.filter(it => itemKeys(list, it).every(k => state.checks[k])).length;
    h += `<div class="stage">${esc(list.title)} <span class="muted">${doneN}/${items.length}</span></div><div class="card">`;
    items.forEach(it => {
      const keys = itemKeys(list, it), done = keys.every(k => state.checks[k]);
      h += `<div class="chk ${done ? 'dn' : ''}"><label class="tx"><input type="checkbox" data-chg="chkall" data-keys="${keys.join('|')}" ${done ? 'checked' : ''}><span class="grow">${it.t}</span>
        ${it.custom ? `<button class="btn sm ghost" data-act="delItem" data-list="${list.id}" data-id="${it.id}" aria-label="remover">✕</button>` : ''}</label>`;
      if (list.perPerson && ppl.length > 1) {
        h += `<div class="who">${ppl.map(p => `<button class="chip ${state.checks[`${list.id}:${it.id}:${p.id}`] ? 'on' : ''}" data-act="chkp" data-key="${list.id}:${it.id}:${p.id}">${esc(p.name)}</button>`).join('')}</div>`;
      }
      h += `</div>`;
    });
    h += `<div class="row" style="margin-top:8px"><input type="text" id="add-${list.id}" placeholder="Adicionar item…"><button class="btn sm" data-act="addItem" data-list="${list.id}">＋</button></div></div>`;
  });
  $('view').innerHTML = h;
}

/* ===== Grupo & veículos ===== */
function vehicleCardHTML(v) {
  const o = oilStatus(v), cur = vehicleOdo(v);
  const f = (key, label, val, ph) => `<div class="fg"><label>${label}</label><input type="text" inputmode="numeric" value="${isNum(val) ? val : ''}" placeholder="${ph || ''}" data-chg="vfield" data-id="${v.id}" data-f="${key}"></div>`;
  let status = '';
  if (o) status = `<div class="small ${o.level === 'ok' ? 'pos' : 'neg'}">🔧 ${o.level === 'overdue' ? `Troca VENCIDA há ${nf(-o.left)} km` : `Próxima troca em ${nf(o.left)} km (no odômetro ${nf(v.oilLastOdo + v.oilEvery)})`}${o.at ? ` — por volta do Dia ${dayNumber(o.at.id)} (${esc(o.at.dest)})` : ''}</div>`;
  else if (isNum(v.oilEvery)) status = `<div class="small muted">Informe também o odômetro da última troca para ativar o alerta.</div>`;
  return `<div class="person ${v.active === false ? 'off' : ''}">
    <div class="fg full"><label>Nome do veículo</label><input type="text" value="${esc(v.name)}" data-chg="vfield" data-id="${v.id}" data-f="name"></div>
    ${f('odo0', 'Odômetro atual (km)', v.odo0, cur ? nf(cur) : '12345')}${f('oilEvery', 'Troca de óleo e filtro a cada (km)', v.oilEvery, 'ex.: 10000')}
    ${f('oilLastOdo', 'Última troca no odômetro (km)', v.oilLastOdo, 'ex.: 8000')}
    <div class="fg"><label>&nbsp;</label><button class="btn sm amber" data-act="oilDone" data-id="${v.id}">🔧 Troquei agora</button></div>
    <div class="full">${status}</div>
    <div class="full row"><button class="btn sm ${v.active === false ? 'ok' : 'ghost'} grow" data-act="toggleVehicle" data-id="${v.id}">${v.active === false ? '↩️ Reativar' : '⏸️ Desativar'}</button>
      ${state.expenses.some(e => e.who === v.id) ? '' : `<button class="btn sm danger" data-act="delVehicle" data-id="${v.id}">Remover</button>`}</div></div>`;
}
function renderGroup() {
  const bal = balances(), M = modeOf();
  let h = `<div class="stage">Integrantes da viagem</div><div class="card">
    <p class="small muted" style="margin-bottom:8px">O grupo pode crescer ou diminuir a qualquer momento. Quem sai fica como <b>inativo</b>: o histórico de gastos é preservado e a pessoa deixa de entrar nas próximas divisões.</p>`;
  if (!state.people.length) h += `<p class="muted">Ninguém cadastrado ainda.</p>`;
  state.people.forEach(p => {
    const v = bal[p.id] || { paid: 0, share: 0 };
    const used = state.expenses.some(e => e.paidBy === p.id || (e.split || []).includes(p.id));
    h += `<div class="person ${p.active === false ? 'off' : ''}">
      <div class="fg full"><label>Nome</label><input type="text" value="${esc(p.name)}" data-chg="pname" data-id="${p.id}"></div>
      <div class="full small muted">Pagou ${BRL(v.paid)} • consumiu ${BRL(v.share)}</div>
      <div class="full row">
        <button class="btn sm ${p.active === false ? 'ok' : 'ghost'} grow" data-act="togglePerson" data-id="${p.id}">${p.active === false ? '↩️ Voltou ao grupo' : '🚪 Saiu do grupo'}</button>
        ${used ? '' : `<button class="btn sm danger" data-act="delPerson" data-id="${p.id}">Remover</button>`}</div></div>`;
  });
  h += `<div class="row" style="margin-top:10px"><input type="text" id="new-person" placeholder="Nome de quem entrou no grupo"><button class="btn" data-act="addPerson">Adicionar</button></div></div>`;
  if (vehiclesOn()) {
    h += `<div class="stage">${M.icon} Veículos & manutenção</div><div class="card">
      <p class="small muted" style="margin-bottom:6px">Informe de quantos em quantos km o veículo precisa trocar óleo e filtro e em que odômetro foi a última troca. O app avisa quando estiver chegando a hora de procurar uma oficina.</p>`;
    if (!state.vehicles.length) h += `<p class="muted small">Nenhum veículo cadastrado.</p>`;
    h += state.vehicles.map(vehicleCardHTML).join('');
    const av = activeVehicles();
    if (av.length > 1) h += `<div class="fg" style="margin-top:8px"><label>Veículo de referência do odômetro diário</label><select data-chg="setting" data-key="refVehicle">${av.map(v => `<option value="${v.id}" ${v.id === refVehicleId() ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></div>`;
    h += `<div class="row" style="margin-top:10px"><input type="text" id="new-vehicle" placeholder="Novo veículo (ex.: ${M.vname} do Daniel)"><button class="btn" data-act="addVehicle">Adicionar</button></div></div>`;
  }
  $('view').innerHTML = h;
}

/* ===== Mais ===== */
const EMERGENCY = [
  ['🇦🇷 Argentina', 'Polícia 911 • Emergência médica 107'],
  ['🇨🇱 Chile', 'Carabineros 133 • Ambulância 131'],
  ['🇺🇾 Uruguai', 'Emergência 911'],
  ['🇧🇷 Brasil', 'SAMU 192 • Polícia 190']
];
function renderMore() {
  const S = state.settings, last = S.lastBackup;
  let h = `<div class="stage">Viagens</div><div class="card">
    <p class="small muted">Você está em: <b>${esc(S.tripName)}</b> (${modeOf().icon} ${esc(modeOf().label)}).</p>
    <div class="btnrow"><button class="btn" data-act="trips">🧳 Trocar de viagem</button><button class="btn amber" data-act="planner">🧭 Novo roteiro</button></div></div>`;
  h += planCardHTML();
  h += `<div class="stage">Backup & dados</div><div class="card">
    <p class="small muted">Último backup: <b>${last ? fmtDT(last) : 'nunca'}</b>. O arquivo guarda esta viagem (roteiro, gastos, grupo, veículos e listas). As fotos ficam só neste aparelho.</p>
    <div class="btnrow"><button class="btn" data-act="exportFile">📤 Exportar backup</button><button class="btn ghost" data-act="importPick">📥 Importar</button></div>
    <div class="btnrow"><button class="btn ghost" data-act="exportText">📋 Copiar resumo</button><button class="btn ghost" data-act="exportCsv">📊 Gastos (CSV)</button></div>
    <p class="small muted" style="margin-top:8px">Dica para o grupo: cada um exporta o seu arquivo e os outros usam <b>Importar ▸ Mesclar</b> para juntar os lançamentos.</p>
    <p class="small" id="persist-state"></p><button class="btn sm ghost" data-act="persist">🔒 Proteger dados contra limpeza do navegador</button></div>`;

  h += `<div class="stage">SOS & localização</div><div class="card">
    <p class="small muted">Usa o GPS do aparelho (funciona sem internet) para montar uma mensagem com sua posição.</p>
    <div class="btnrow"><button class="btn danger" data-act="sos">📍 Obter minha posição</button></div>
    <div id="sos-out"></div></div>`;

  h += `<div class="stage">Contatos & emergência</div><div class="card">`;
  h += state.contacts.length ? state.contacts.map(c => `<div class="cat"><div><b>${esc(c.name)}</b><div class="small muted">${esc(c.note || '')}</div></div>
    <div class="row"><a class="btn sm" href="tel:${esc((c.phone || '').replace(/[^\d+]/g, ''))}">📞 ${esc(c.phone)}</a><button class="btn sm ghost" data-act="editContact" data-id="${c.id}">✏️</button></div></div>`).join('')
    : `<p class="small muted">Adicione seguradora, assistência 24h, consulados, hotéis e telefones do grupo.</p>`;
  h += `<div class="btnrow"><button class="btn" data-act="editContact">＋ Novo contato</button></div>
    <div class="sub" style="margin-top:12px">Números de emergência (confira antes de viajar)</div>` +
    EMERGENCY.map(([c, t]) => `<div class="small" style="padding:3px 0"><b>${c}</b> — ${t}</div>`).join('') + `</div>`;

  const inp = (key, label, val, ph = '', mode = 'text') => `<div class="fg"><label>${label}</label><input type="text" inputmode="${mode}" value="${esc(val)}" placeholder="${ph}" data-chg="setting" data-key="${key}"></div>`;
  h += `<div class="stage">Configurações</div><div class="card">
    ${inp('tripName', 'Nome da viagem', S.tripName)}
    <div class="fg"><label>Como a viagem é feita</label><select data-chg="setting" data-key="mode">${Object.keys(MODES).map(k => `<option value="${k}" ${state.mode === k ? 'selected' : ''}>${MODES[k].icon} ${MODES[k].label}</option>`).join('')}</select></div>
    <div class="fgrid">${vehiclesOn() ? inp('autonomy', 'Autonomia (km, com galão)', S.autonomy, '300', 'numeric') : ''}${inp('budget', 'Orçamento total (R$)', S.budget || '', 'opcional', 'decimal')}</div>
    <div class="fg"><label>Data limite de volta (opcional)</label><input type="date" value="${esc(S.deadline)}" data-chg="setting" data-key="deadline"></div>
    <div class="sub">Cotações (R$ por 1 unidade)</div>
    <div class="fgrid">${CURRENCIES.filter(c => c !== 'BRL').map(c => inp('rate:' + c, c, S.rates[c] || '', 'ex.: 5,50', 'decimal')).join('')}</div>
    <div class="fgrid"><div class="fg"><label>Tema</label><select data-chg="setting" data-key="theme">
      ${[['auto', 'Automático'], ['dark', 'Escuro'], ['light', 'Claro (sol)']].map(([v, l]) => `<option value="${v}" ${S.theme === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="fg"><label>Modo luvas</label><label class="ck"><input type="checkbox" data-chg="setting" data-key="gloves" ${S.gloves ? 'checked' : ''}> botões maiores</label></div></div></div>`;

  h += `<div class="stage">App & uso offline</div><div class="card">
    <p class="small" id="sw-state">Verificando…</p>
    <p class="small" id="ocr-state"></p>
    ${deferredInstall ? `<div class="btnrow"><button class="btn ok" data-act="install">⬇️ Instalar app</button></div>` : ''}
    <p class="small muted"><b>Android (Chrome):</b> menu ⋮ ▸ Instalar app. <b>iPhone (Safari):</b> Compartilhar ▸ Adicionar à Tela de Início.
    Abra o app uma vez com internet para ele ficar disponível offline. Baixe também mapas offline (Google Maps ▸ Mapas off-line, ou Organic Maps) antes de sair.</p></div>`;

  h += `<div class="stage">Zona de perigo</div><div class="card"><button class="btn danger block" data-act="zerar">🗑️ Apagar todos os dados desta viagem</button></div>`;
  $('view').innerHTML = h;
  updatePersistState(); updateSwState(); updateOcrState();
}
async function updatePersistState() {
  const el = $('persist-state'); if (!el) return;
  try { const p = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null;
    el.textContent = p === true ? '🔒 Armazenamento protegido.' : p === false ? '⚠️ Armazenamento ainda não protegido — toque no botão abaixo.' : ''; } catch (e) { /* ok */ }
}
async function updateSwState() {
  const el = $('sw-state'); if (!el) return;
  let t = 'Service worker não suportado neste navegador.';
  if ('serviceWorker' in navigator) {
    try { const r = await navigator.serviceWorker.getRegistration(); t = r && r.active ? '✅ Pronto para uso offline.' : '⏳ Preparando uso offline (abra uma vez com internet).'; } catch (e) { t = 'Sem service worker.'; }
  }
  el.textContent = t;
}

/* ===== Navegação ===== */
function renderView() {
  const fn = { route: renderRoute, finance: renderFinance, lists: renderLists, group: renderGroup, more: renderMore }[curView];
  fn();
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.view === curView));
}
function refresh() {
  const y = window.scrollY;
  renderHeader(); renderView();
  window.scrollTo(0, y);
}
function setView(v) {
  scrollByView[curView] = window.scrollY;
  curView = v; renderView();
  window.scrollTo(0, scrollByView[v] || 0);
}
function goCurrent() {
  if (curView !== 'route') setView('route');
  const id = currentDayId(); if (!id) return;
  const el = $('day-' + id); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
}
