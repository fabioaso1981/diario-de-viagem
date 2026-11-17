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
  const st = tripStats(), n = activePeople().length;
  $('badge').textContent = `🏍️ ${n} ${n === 1 ? 'piloto' : 'pilotos'} • 2027`;
  $('trip-title').textContent = state.settings.tripName;
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
  const exps = state.expenses, total = sumBRL(exps), n = activePeople().length || 1;
  const fs = fuelStats(), kml = fs.l > 0 ? fs.km / fs.l : null, lf = lastFuelInfo(), S = state.settings;
  const c = [];
  c.push(`<div class="dash-card"><span class="dl">🏍️ Percorrido</span><span class="dv">${nf(st.done)} km</span><span class="ds">faltam ${nf(st.remaining)} km</span></div>`);
  const slack = st.slack;
  c.push(`<div class="dash-card"><span class="dl">📅 Chegada prevista</span><span class="dv ${slack != null && slack < 0 ? 'bad' : ''}">${st.arrival ? fmtShort(st.arrival) : '--'}</span><span class="ds">${slack != null ? (slack >= 0 ? `folga de ${slack} d` : `${-slack} d além do limite`) : (st.pace ? `ritmo real ${nf(st.pace)} km/dia` : 'defina a data limite em Mais')}</span></div>`);
  c.push(`<div class="dash-card"><span class="dl">💰 Gasto total</span><span class="dv">${BRL(total)}</span><span class="ds">${BRL(total / n)} por pessoa${S.budget > 0 ? ` • ${Math.round(total / S.budget * 100)}% do orçamento` : ''}</span></div>`);
  c.push(`<div class="dash-card"><span class="dl">⛽ Média</span><span class="dv">${kml ? nf(kml, 1) + ' km/L' : '-- km/L'}</span><span class="ds">${kml ? `${nf(fs.km)} km / ${nf(fs.l, 1)} L` : 'abasteça com tanque cheio'}</span></div>`);
  if (lf) {
    const low = lf.left < 100;
    c.push(`<div class="dash-card wide"><span class="dl">⛽ Autonomia (desde o último abastecimento)</span><span class="dv ${low ? 'bad' : ''}">≈ ${nf(Math.max(0, lf.left))} km restantes</span><span class="ds">rodou ${nf(lf.since)} km • autonomia configurada ${nf(S.autonomy)} km (com galão)</span></div>`);
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
const isOpenDay = (id, curId) => expandedState[id] !== undefined ? expandedState[id] : id === curId;

function dayHTML(d, curId, fs) {
  const isCur = d.id === curId, open = isOpenDay(d.id, curId), exps = dayExpenses(d.id), cost = sumBRL(exps);
  const rk = realKm(d), today = d.date === todayISO(), diff = diffDays(d.date, d.planDate);
  let dkm = 0, dl = 0;
  exps.forEach(e => { const s = fs.perEntry[e.id]; if (s) { dkm += s.km; dl += s.l; } });
  const pills = [];
  if (d.km > 0) pills.push(`<span class="pill">📏 ${nf(d.km)} km</span>`);
  if (rk != null) pills.push(`<span class="pill good">🏍️ ${nf(rk)} km reais${d.km > 0 ? ` (${rk - d.km >= 0 ? '+' : ''}${nf(rk - d.km)})` : ''}</span>`);
  if (d.time !== '-') pills.push(`<span class="pill">⏱️ ${esc(d.time)}</span>`);
  pills.push(`<span class="pill">${esc(d.country)}</span>`);
  if (cost > 0) pills.push(`<span class="pill cost">💰 ${BRL(cost)}</span>`);
  if (dl > 0) pills.push(`<span class="pill fuel">⛽ ${nf(dkm / dl, 1)} km/L</span>`);
  pills.push(`<a class="pill" href="${esc(mapLink(d))}" target="_blank" rel="noopener">🗺️ Mapa</a>`);

  let h = `<section class="card day ${d.status} ${isCur ? 'cur' : ''}" id="day-${d.id}">
    <div class="day-badge">DIA ${dayNumber(d.id)} • ${fmtDate(d.date)}
      ${isCur ? '<span class="tag">ATUAL</span>' : ''}${today ? '<span class="tag">HOJE</span>' : ''}
      ${diff !== 0 ? `<span class="tag alt">${diff > 0 ? '+' : ''}${diff} d vs plano</span>` : ''}${d.isExtra ? '<span class="tag alt">EXTRA</span>' : ''}${d.changedRoute ? '<span class="tag alt">trecho alterado</span>' : ''}</div>
    <div class="route-title">${esc(d.origin)} → ${esc(d.dest)}</div>
    <div class="metrics">${pills.join('')}</div>
    <div class="seg">${['pending', 'doing', 'done', 'skipped'].map(s =>
      `<button data-act="status" data-id="${d.id}" data-st="${s}" class="${d.status === s ? 'on' : ''}">${STATUS[s]}</button>`).join('')}</div>`;

  if (open) {
    const lf = lastFuelInfo();
    if (d.gasWarning) h += `<div class="gas">🚨 COMBUSTÍVEL: galão extra cheio! Postos escassos neste trecho.${lf ? ` Autonomia restante ≈ ${nf(Math.max(0, lf.left))} km.` : ''}</div>`;
    h += `<div class="hl"><strong>Observações:</strong> ${esc(d.highlights)}</div>`;
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
    h += `<div class="box"><div class="row between"><span class="small">🔢 Odômetro: ${d.odoStart != null ? nf(d.odoStart) : '—'} → ${d.odoEnd != null ? nf(d.odoEnd) : '—'}</span>
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
      <button class="btn amber" data-act="openExp" data-day="${d.id}" data-cat="abastecimento">⛽ Abastecer</button>
      <button class="btn amber" data-act="openExp" data-day="${d.id}">💰 Gasto</button>
      <button class="btn ghost" data-act="odo" data-id="${d.id}">🔢 Odômetro</button>
      <button class="btn ghost" data-act="note" data-day="${d.id}">📝 Anotar</button>
      <button class="btn ghost" data-act="photo" data-id="${d.id}">📷 Foto</button>
      <button class="btn ghost" data-act="editDay" data-id="${d.id}">✏️ Editar</button></div>`;
  }
  h += `<button class="more-toggle" data-act="expand" data-id="${d.id}">${open ? 'Recolher ▴' : 'Detalhes ▾'}</button></section>`;
  return h;
}

function renderRoute() {
  const curId = currentDayId(), fs = fuelStats();
  let days = orderedDays();
  if (routeFilter === 'pending') days = days.filter(d => d.status === 'pending' || d.status === 'doing');
  if (routeFilter === 'cur') days = days.filter(d => d.id === curId);
  let h = backupBanner() + `<div class="chips">
    ${[['all', 'Todos'], ['pending', 'Pendentes'], ['cur', 'Atual']].map(([f, l]) => `<button class="chip ${routeFilter === f ? 'on' : ''}" data-act="filter" data-f="${f}">${l}</button>`).join('')}
    <button class="chip" data-act="goCur">📍 Ir ao atual</button>
    <button class="chip" data-act="adjust">⚙️ Ajustar roteiro</button></div>`;
  if (!days.length) h += `<div class="card" style="text-align:center"><h3>${routeFilter === 'all' ? 'Sem dias' : 'Nada pendente 🎉'}</h3><p class="muted small">${routeFilter === 'pending' ? 'Expedição concluída! Goiânia ⇄ Ushuaia conquistado.' : ''}</p></div>`;
  let last = '';
  days.forEach(d => {
    if (d.stage !== last) { h += `<div class="stage">${esc(d.stage)}</div>`; last = d.stage; }
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

  /* Divisão do grupo */
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

  /* Consumo */
  const fs = fuelStats();
  h += `<div class="stage">Consumo de combustível</div><div class="card">`;
  if (fs.l > 0) {
    h += `<div class="cat"><b>Média geral</b><b style="color:var(--amber)">${nf(fs.km / fs.l, 1)} km/L</b></div>`;
    Object.entries(fs.byWho).forEach(([k, v]) => { h += `<div class="cat"><span>${k === '_' ? 'Sem moto/piloto definido' : esc(pName(k))}</span><span>${nf(v.km / v.l, 1)} km/L <span class="small muted">(${nf(v.km)} km / ${nf(v.l, 1)} L)</span></span></div>`; });
  } else h += `<p class="muted small">A média usa o método tanque cheio → tanque cheio: registre o odômetro e marque "tanque cheio" em cada abastecimento.</p>`;
  const fuels = exps.filter(e => e.category === 'abastecimento').sort((a, b) => b.ts - a.ts);
  if (fuels.length) {
    h += `<div class="sub" style="margin-top:8px">Abastecimentos</div>` + fuels.map(e => {
      const s = fs.perEntry[e.id], d = getDay(e.dayId);
      const meta = [d ? `Dia ${dayNumber(e.dayId)}` : '', fmtDT(e.ts), e.who ? pName(e.who) : '', e.odo ? 'odô ' + nf(e.odo) : '', e.liters ? nf(e.liters, 1) + ' L' : '', e.liters > 0 ? BRL(e.brl / e.liters) + '/L' : '', e.full ? '' : 'parcial'].filter(Boolean).join(' • ');
      return `<button class="item" data-act="openExp" data-id="${e.id}"><span class="l"><span class="t">${esc(e.desc || 'Abastecimento')}</span><span class="m">${esc(meta)}</span>${s ? `<span class="m" style="color:var(--amber)">${nf(s.km)} km → ${nf(s.km / s.l, 1)} km/L</span>` : ''}</span><span class="a">${BRL(e.brl)}</span></button>`;
    }).join('');
  }
  h += `</div>`;

  /* Passeios planejados */
  const pt = plannedToursUSD(), usd = S.rates.USD;
  h += `<div class="stage">Passeios: planejado × gasto</div><div class="card">
    <div class="cat"><span>Planejado (roteiro)</span><b>USD ${pt.min} – ${pt.max}${usd ? ` <span class="small muted">≈ ${BRL(pt.min * usd)} – ${BRL(pt.max * usd)}</span>` : ''}</b></div>
    <div class="cat"><span>Gasto em passeios</span><b>${BRL(cat.passeios)}</b></div>
    ${usd ? '' : '<p class="small muted">Informe a cotação do USD em Mais ▸ Configurações para ver em reais.</p>'}</div>`;

  /* Histórico */
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
  LISTS.forEach(list => {
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

/* ===== Grupo ===== */
function renderGroup() {
  const bal = balances();
  let h = `<div class="stage">Integrantes da viagem</div><div class="card">
    <p class="small muted" style="margin-bottom:8px">O grupo pode crescer ou diminuir a qualquer momento. Quem sai fica como <b>inativo</b>: o histórico de gastos é preservado e a pessoa deixa de entrar nas próximas divisões.</p>`;
  if (!state.people.length) h += `<p class="muted">Ninguém cadastrado ainda.</p>`;
  state.people.forEach(p => {
    const v = bal[p.id] || { paid: 0, share: 0 };
    const used = state.expenses.some(e => e.paidBy === p.id || e.who === p.id || (e.split || []).includes(p.id));
    h += `<div class="person ${p.active === false ? 'off' : ''}">
      <div class="fg"><label>Nome</label><input type="text" value="${esc(p.name)}" data-chg="pname" data-id="${p.id}"></div>
      <div class="fg"><label>Moto / observação</label><input type="text" value="${esc(p.bike || '')}" placeholder="BMW F 850 GS" data-chg="pbike" data-id="${p.id}"></div>
      <div class="full small muted">Pagou ${BRL(v.paid)} • consumiu ${BRL(v.share)}</div>
      <div class="full row">
        <button class="btn sm ${p.active === false ? 'ok' : 'ghost'} grow" data-act="togglePerson" data-id="${p.id}">${p.active === false ? '↩️ Voltou ao grupo' : '🚪 Saiu do grupo'}</button>
        ${used ? '' : `<button class="btn sm danger" data-act="delPerson" data-id="${p.id}">Remover</button>`}</div></div>`;
  });
  h += `<div class="row" style="margin-top:10px"><input type="text" id="new-person" placeholder="Nome de quem entrou no grupo"><button class="btn" data-act="addPerson">Adicionar</button></div></div>`;
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
  let h = `<div class="stage">Backup & dados</div><div class="card">
    <p class="small muted">Último backup: <b>${last ? fmtDT(last) : 'nunca'}</b>. O arquivo guarda roteiro, gastos, grupo e listas (as fotos ficam só neste aparelho).</p>
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
    <div class="fgrid">${inp('autonomy', 'Autonomia (km, com galão)', S.autonomy, '300', 'numeric')}${inp('budget', 'Orçamento total (R$)', S.budget || '', 'opcional', 'decimal')}</div>
    <div class="fg"><label>Data limite de volta (opcional)</label><input type="date" value="${esc(S.deadline)}" data-chg="setting" data-key="deadline"></div>
    <div class="sub">Cotações (R$ por 1 unidade)</div>
    <div class="fgrid">${CURRENCIES.filter(c => c !== 'BRL').map(c => inp('rate:' + c, c, S.rates[c] || '', 'ex.: 5,50', 'decimal')).join('')}</div>
    <div class="fgrid"><div class="fg"><label>Tema</label><select data-chg="setting" data-key="theme">
      ${[['auto', 'Automático'], ['dark', 'Escuro'], ['light', 'Claro (sol)']].map(([v, l]) => `<option value="${v}" ${S.theme === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="fg"><label>Modo luvas</label><label class="ck"><input type="checkbox" data-chg="setting" data-key="gloves" ${S.gloves ? 'checked' : ''}> botões maiores</label></div></div></div>`;

  h += `<div class="stage">App & uso offline</div><div class="card">
    <p class="small" id="sw-state">Verificando…</p>
    ${deferredInstall ? `<div class="btnrow"><button class="btn ok" data-act="install">⬇️ Instalar app</button></div>` : ''}
    <p class="small muted"><b>Android (Chrome):</b> menu ⋮ ▸ Instalar app. <b>iPhone (Safari):</b> Compartilhar ▸ Adicionar à Tela de Início.
    Abra o app uma vez com internet para ele ficar disponível offline. Baixe também mapas offline (Google Maps ▸ Mapas off-line, ou Organic Maps) antes de sair.</p></div>`;

  h += `<div class="stage">Zona de perigo</div><div class="card"><button class="btn danger block" data-act="zerar">🗑️ Apagar todos os dados do app</button></div>`;
  $('view').innerHTML = h;
  updatePersistState(); updateSwState();
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
  if (routeFilter === 'cur' || routeFilter === 'pending') { /* já visível */ }
  const el = $('day-' + id); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

/* ===== Modais: despesa ===== */
const dayOptions = sel => orderedDays().map(d => `<option value="${d.id}" ${d.id === sel ? 'selected' : ''}>Dia ${dayNumber(d.id)} — ${esc(d.dest)}</option>`).join('');
function personOptions(sel, none) {
  return `<option value="">${none}</option>` + state.people.filter(p => p.active !== false || p.id === sel)
    .map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
}
function openExpense(o = {}) {
  const old = o.id ? state.expenses.find(e => e.id === o.id) : null, S = state.settings, ppl = activePeople();
  const e = old ? { ...old } : { dayId: o.dayId || currentDayId() || state.order[0], ts: Date.now(), category: o.category || 'alimentacao',
    currency: S.lastCurrency || 'BRL', paidBy: S.lastPayer || (ppl.length === 1 ? ppl[0].id : ''), split: ppl.map(p => p.id), full: true, who: '' };
  if (!old && e.currency !== 'BRL') e.rate = S.rates[e.currency] || '';
  if (!old && o.category === 'abastecimento') { e.who = e.paidBy; e.odo = currentOdo() || ''; }
  const splitPeople = state.people.filter(p => p.active !== false || (e.split || []).includes(p.id));
  openModal(`<h2>${old ? 'Editar' : 'Novo'} lançamento</h2>
    <div class="fgrid">
      <div class="fg"><label>Dia</label><select id="x-day">${dayOptions(e.dayId)}</select></div>
      <div class="fg"><label>Categoria</label><select id="x-cat" data-chg="xrecalc">${Object.keys(CATS).map(k => `<option value="${k}" ${e.category === k ? 'selected' : ''}>${CATS[k].icon} ${CATS[k].label}</option>`).join('')}</select></div>
      <div class="fg"><label>Valor</label><input type="text" inputmode="decimal" id="x-amt" value="${old ? e.amount : ''}" placeholder="0,00" data-inp="xrecalc"></div>
      <div class="fg"><label>Moeda</label><select id="x-cur" data-chg="xrecalc">${CURRENCIES.map(c => `<option ${e.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    </div>
    <div class="fg ${e.currency === 'BRL' ? 'hidden' : ''}" id="x-ratebox"><label>Cotação: R$ por 1 <span id="x-curname">${esc(e.currency)}</span></label><input type="text" inputmode="decimal" id="x-rate" value="${e.rate || ''}" placeholder="ex.: 5,50" data-inp="xrecalc"></div>
    <p class="small muted" id="x-hint"></p>
    <div class="fuelbox ${e.category === 'abastecimento' ? '' : 'hidden'}" id="x-fuel">
      <div class="fgrid">
        <div class="fg"><label>Litros</label><input type="text" inputmode="decimal" id="x-liters" value="${e.liters || ''}" placeholder="13,8" data-inp="xrecalc"></div>
        <div class="fg"><label>Odômetro (km)</label><input type="text" inputmode="numeric" id="x-odo" value="${e.odo || ''}" placeholder="12345"></div>
        <div class="fg"><label>Moto de quem</label><select id="x-who">${personOptions(e.who, '— não definido —')}</select></div>
        <div class="fg"><label>Km desde o último (se sem odômetro)</label><input type="text" inputmode="decimal" id="x-kmtrip" value="${e.kmTrip || ''}"></div>
      </div>
      <label class="ck"><input type="checkbox" id="x-full" ${e.full ? 'checked' : ''}> Tanque cheio (necessário para calcular o km/L)</label>
    </div>
    <div class="fg"><label>Descrição / local</label><input type="text" id="x-desc" value="${esc(e.desc || '')}" placeholder="Posto YPF, hotel, almoço…"></div>
    <div class="fg"><label>Pago por</label><select id="x-paid">${personOptions(e.paidBy, '— não dividir —')}</select></div>
    <div class="fg"><label>Dividir entre</label><div class="chips" id="x-split">${splitPeople.map(p => `<label class="chip"><input type="checkbox" value="${p.id}" ${(e.split || []).includes(p.id) ? 'checked' : ''}><span>${esc(p.name)}</span></label>`).join('') || '<span class="small muted">Cadastre o grupo na aba Grupo.</span>'}</div></div>
    <div class="fg"><label>Data e hora</label><input type="datetime-local" id="x-ts" value="${toLocalInput(e.ts)}"></div>
    ${btns(B('saveExp', 'Salvar', 'ok', `data-id="${old ? old.id : ''}"`), B('closeModal', 'Cancelar', 'ghost'), old ? B('delExp', 'Excluir', 'danger', `data-id="${old.id}"`) : '')}`);
  recalcExpense();
}
function recalcExpense() {
  if (!$('x-cat')) return;
  const cat = $('x-cat').value, cur = $('x-cur').value;
  $('x-fuel').classList.toggle('hidden', cat !== 'abastecimento');
  $('x-ratebox').classList.toggle('hidden', cur === 'BRL');
  $('x-curname').textContent = cur;
  if (cur !== 'BRL' && !$('x-rate').value && state.settings.rates[cur]) $('x-rate').value = String(state.settings.rates[cur]).replace('.', ',');
  const amt = num($('x-amt').value), rate = cur === 'BRL' ? 1 : num($('x-rate').value), lit = num($('x-liters').value);
  let t = '';
  if (amt > 0 && rate > 0) t += `≈ ${BRL(amt * rate)}`;
  if (cat === 'abastecimento' && amt > 0 && rate > 0 && lit > 0) t += ` • ${BRL(amt * rate / lit)} por litro`;
  $('x-hint').textContent = t;
}
function saveExpense(id) {
  const amount = num($('x-amt').value);
  if (!(amount > 0)) return toast('Informe um valor válido.');
  const currency = $('x-cur').value; let rate = 1;
  if (currency !== 'BRL') {
    rate = num($('x-rate').value);
    if (!(rate > 0)) return toast(`Informe a cotação (R$ por 1 ${currency}).`);
    state.settings.rates[currency] = rate;
  }
  const category = $('x-cat').value, paidBy = $('x-paid').value;
  const exp = { id: id || uid(), dayId: $('x-day').value, ts: fromLocalInput($('x-ts').value), category, amount, currency, rate, brl: amount * rate,
    desc: $('x-desc').value.trim(), paidBy, split: [...document.querySelectorAll('#x-split input:checked')].map(i => i.value) };
  if (category === 'abastecimento') {
    const lit = num($('x-liters').value);
    if (!(lit > 0)) return toast('Informe os litros abastecidos.');
    exp.liters = lit; exp.full = $('x-full').checked; exp.who = $('x-who').value;
    const odo = num($('x-odo').value), kt = num($('x-kmtrip').value);
    if (odo > 0) exp.odo = Math.round(odo); if (kt > 0) exp.kmTrip = kt;
  }
  state.settings.lastPayer = paidBy; state.settings.lastCurrency = currency;
  const i = state.expenses.findIndex(e => e.id === exp.id);
  if (i >= 0) state.expenses[i] = exp; else state.expenses.push(exp);
  save(); closeModal(); refresh(); toast('Lançamento salvo.');
}

/* ===== Modais: odômetro, dia, anotação, ajustes ===== */
function openOdo(id) {
  const d = getDay(id); let start = d.odoStart;
  if (start == null) {
    const idx = state.order.indexOf(id);
    for (let i = idx - 1; i >= 0; i--) { const p = getDay(state.order[i]); if (p && p.odoEnd != null) { start = p.odoEnd; break; } }
  }
  openModal(`<h2>🔢 Odômetro — Dia ${dayNumber(id)}</h2><p class="small muted">${esc(d.origin)} → ${esc(d.dest)}</p>
    <div class="fgrid" style="margin-top:8px"><div class="fg"><label>Saída (km)</label><input type="text" inputmode="numeric" id="o-start" value="${start != null ? start : ''}"></div>
    <div class="fg"><label>Chegada (km)</label><input type="text" inputmode="numeric" id="o-end" value="${d.odoEnd != null ? d.odoEnd : ''}"></div></div>
    <label class="ck"><input type="checkbox" id="o-done" ${d.status !== 'done' ? 'checked' : ''}> Marcar dia como concluído</label>
    ${btns(B('saveOdo', 'Salvar', 'ok', `data-id="${id}"`), B('closeModal', 'Cancelar', 'ghost'))}`);
}
function saveOdo(id) {
  const s = num($('o-start').value), e = num($('o-end').value), o = ovr(id);
  if (isNaN(s)) delete o.odoStart; else o.odoStart = Math.round(s);
  if (isNaN(e)) delete o.odoEnd; else o.odoEnd = Math.round(e);
  if (!isNaN(s) && !isNaN(e) && e < s) return toast('A chegada não pode ser menor que a saída.');
  if (!isNaN(e) && $('o-done').checked && (o.status || 'pending') !== 'done') o.status = 'done';
  save(); closeModal(); refresh(); toast('Odômetro salvo.');
}
function openDayEdit(id) {
  const d = getDay(id), h = d.hotel, f = (i, l, v, ph = '', t = 'text') => `<div class="fg"><label>${l}</label><input type="${t}" id="${i}" value="${esc(v || '')}" placeholder="${ph}"></div>`;
  openModal(`<h2>✏️ Dia ${dayNumber(id)}</h2>
    <div class="fgrid"><div class="fg"><label>Data real</label><input type="date" id="e-date" value="${d.date}"></div>
    <div class="fg"><label>Status</label><select id="e-status">${Object.keys(STATUS).map(s => `<option value="${s}" ${d.status === s ? 'selected' : ''}>${STATUS[s]}</option>`).join('')}</select></div></div>
    ${f('e-origin', 'Origem', d.origin)}${f('e-dest', 'Destino (onde dormiu / vai dormir)', d.dest)}
    <div class="fgrid">${f('e-km', 'Km previstos', d.km)}<div></div>${f('e-os', 'Odômetro saída', d.odoStart)}${f('e-oe', 'Odômetro chegada', d.odoEnd)}</div>
    <div class="sub" style="margin-top:6px">🏨 Hospedagem / reserva (fica salvo offline)</div>
    ${f('h-name', 'Nome', h.name)}${f('h-addr', 'Endereço', h.addr)}
    <div class="fgrid">${f('h-phone', 'Telefone', h.phone, '+54 …', 'tel')}${f('h-conf', 'Código da reserva', h.conf)}${f('h-checkin', 'Check-in', h.checkin, 'ex.: a partir das 14h')}${f('h-coords', 'Coordenadas', h.coords, '-54.80, -68.30')}</div>
    ${btns(B('saveDay', 'Salvar', 'ok', `data-id="${id}"`), B('closeModal', 'Cancelar', 'ghost'))}
    <div class="btnrow"><button class="btn ghost sm" data-act="pushThis" data-id="${id}">⏩ Empurrar este dia e os seguintes +1</button>
    <button class="btn ghost sm" data-act="resetDay" data-id="${id}">↩️ Restaurar plano</button>
    ${d.isExtra ? `<button class="btn danger sm" data-act="delDay" data-id="${id}">Excluir dia extra</button>` : ''}</div>`);
}
function saveDay(id) {
  const b = baseOf(id), o = ovr(id), v = i => $(i).value.trim();
  const date = v('e-date');
  if (date && date !== b.date) o.date = date; else delete o.date;
  if (v('e-origin') && v('e-origin') !== b.origin) o.origin = v('e-origin'); else delete o.origin;
  if (v('e-dest') && v('e-dest') !== b.dest) o.dest = v('e-dest'); else delete o.dest;
  const km = num(v('e-km')); if (!isNaN(km) && km !== b.km) o.km = km; else delete o.km;
  const os = num(v('e-os')), oe = num(v('e-oe'));
  if (!isNaN(os) && !isNaN(oe) && oe < os) return toast('A chegada não pode ser menor que a saída.');
  if (isNaN(os)) delete o.odoStart; else o.odoStart = Math.round(os);
  if (isNaN(oe)) delete o.odoEnd; else o.odoEnd = Math.round(oe);
  const st = $('e-status').value; if (st !== 'pending') o.status = st; else delete o.status;
  const hotel = { name: v('h-name'), addr: v('h-addr'), phone: v('h-phone'), conf: v('h-conf'), checkin: v('h-checkin'), coords: v('h-coords') };
  if (Object.values(hotel).some(Boolean)) o.hotel = hotel; else delete o.hotel;
  save(); closeModal(); refresh(); toast('Dia atualizado.');
}
const WX = (sel) => WEATHER.map(w => `<label class="chip"><input type="radio" name="l-wx" value="${w}" ${sel === w ? 'checked' : ''}><span>${w}</span></label>`).join('');
function openLog(dayId, id) {
  const o = ovr(dayId), old = id ? (o.log || []).find(l => l.id === id) : null, l = old || { ts: Date.now(), text: '' };
  openModal(`<h2>📝 ${old ? 'Editar anotação' : 'Nova anotação'}</h2>
    <div class="fg"><label>O que aconteceu?</label><textarea id="l-text" placeholder="Estrada, imprevistos, hospedagem, câmbio, pessoas…">${esc(l.text)}</textarea></div>
    <div class="fg"><label>Clima</label><div class="chips">${WX(l.weather)}</div></div>
    <div class="fgrid"><div class="fg"><label>Temperatura (°C)</label><input type="text" inputmode="numeric" id="l-temp" value="${isNum(l.temp) ? l.temp : ''}"></div>
    <div class="fg"><label>Data e hora</label><input type="datetime-local" id="l-ts" value="${toLocalInput(l.ts)}"></div></div>
    ${btns(B('saveLog', 'Salvar', 'ok', `data-day="${dayId}" data-id="${old ? old.id : ''}"`), B('closeModal', 'Cancelar', 'ghost'), old ? B('delLog', 'Excluir', 'danger', `data-day="${dayId}" data-id="${old.id}"`) : '')}`);
}
function saveLog(dayId, id) {
  const text = $('l-text').value.trim(); if (!text) return toast('Escreva algo.');
  const wx = document.querySelector('input[name=l-wx]:checked'), t = num($('l-temp').value);
  const entry = { id: id || uid(), ts: fromLocalInput($('l-ts').value), text, weather: wx ? wx.value : '', temp: isNaN(t) ? null : t };
  const o = ovr(dayId); o.log = o.log || [];
  const i = o.log.findIndex(l => l.id === entry.id);
  if (i >= 0) o.log[i] = entry; else o.log.push(entry);
  expandedState[dayId] = true;
  save(); closeModal(); refresh(); toast('Anotação salva.');
}
function shiftFrom(id, n) {
  const idx = state.order.indexOf(id);
  state.order.slice(idx).forEach(x => { const d = getDay(x); ovr(x).date = addDaysISO(d.date, n); });
}
function openAdjust() {
  const cur = currentDayId() || state.order[0];
  openModal(`<h2>⚙️ Ajustar roteiro</h2>
    <div class="card"><h3>⏩ Atrasou? Empurrar as datas</h3><p class="small muted">Desloca a data do dia escolhido e de todos os seguintes (negativo adianta).</p>
      <div class="fgrid" style="margin-top:6px"><div class="fg"><label>A partir do dia</label><select id="a-from">${dayOptions(cur)}</select></div>
      <div class="fg"><label>Dias</label><input type="text" inputmode="numeric" id="a-n" value="1"></div></div>
      ${B('applyPush', 'Aplicar', 'amber block')}</div>
    <div class="card"><h3>➕ Adicionar dia extra</h3><p class="small muted">Para pane, clima, descanso ou desvio. Entra depois do dia escolhido.</p>
      <div class="fg"><label>Depois do dia</label><select id="a-after">${dayOptions(cur)}</select></div>
      <div class="fg"><label>Descrição / local</label><input type="text" id="a-title" placeholder="Ex.: Parado em Río Gallegos (pneu)"></div>
      <label class="ck"><input type="checkbox" id="a-push" checked> Empurrar os dias seguintes +1</label>${B('addExtra', 'Adicionar dia extra', 'amber block')}</div>
    <div class="card"><h3>↩️ Voltar ao plano</h3>${B('resetDates', 'Restaurar todas as datas originais', 'ghost block')}</div>
    ${btns(B('closeModal', 'Fechar', 'ghost'))}`);
}
function addExtraDay(afterId, title, push) {
  const a = getDay(afterId), id = 'x' + uid();
  state.extra.push({ id, extra: true, stage: a.stage, date: push ? addDaysISO(a.date, 1) : a.date, origin: a.dest, dest: title || 'Dia extra', km: 0, time: '-', country: a.country,
    highlights: 'Dia extra (imprevisto, descanso ou desvio).', gasWarning: false, tours: [], mapUrl: '' });
  const idx = state.order.indexOf(afterId) + 1;
  state.order.splice(idx, 0, id);
  if (push && state.order[idx + 1]) shiftFrom(state.order[idx + 1], 1);
  return id;
}

/* ===== Registro rápido / fotos ===== */
function openQuick() {
  const cur = currentDayId() || state.order[0];
  openModal(`<h2>Registrar agora</h2><div class="fg"><label>Dia</label><select id="q-day">${dayOptions(cur)}</select></div>
    <div class="actions" style="grid-template-columns:1fr 1fr">
      <button class="btn amber" style="min-height:64px" data-act="qExp" data-cat="abastecimento">⛽ Abastecer</button>
      <button class="btn amber" style="min-height:64px" data-act="qExp">💰 Gasto</button>
      <button class="btn" style="min-height:64px" data-act="qOdo">🔢 Odômetro</button>
      <button class="btn" style="min-height:64px" data-act="qNote">📝 Anotação</button>
      <button class="btn" style="min-height:64px" data-act="qPhoto">📷 Foto</button>
      <button class="btn ok" style="min-height:64px" data-act="qDone">✅ Concluir dia</button></div>
    ${btns(B('closeModal', 'Fechar', 'ghost'))}`);
}
function resizeImage(file, max) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? res(b) : rej(new Error('blob')), 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); };
    img.src = url;
  });
}
async function handlePhoto(file) {
  if (!file || !photoDay) return;
  try {
    const blob = await resizeImage(file, 1280);
    await IDB.put('photos', { id: uid(), dayId: photoDay, ts: Date.now(), blob });
    expandedState[photoDay] = true; refresh(); toast('Foto salva neste aparelho.');
  } catch (e) { toast('Não foi possível salvar a foto.'); }
}
async function viewPhoto(id) {
  try {
    const p = await IDB.get('photos', id); if (!p) return;
    const v = document.createElement('div'); v.className = 'viewer'; v.id = 'viewer';
    v.innerHTML = `<img src="${photoUrls[id] || (photoUrls[id] = URL.createObjectURL(p.blob))}" alt="foto"><div class="row"><button class="btn danger" data-act="delPhoto" data-id="${id}">Excluir</button><button class="btn" data-act="closeViewer">Fechar</button></div>`;
    document.body.appendChild(v);
  } catch (e) { /* ok */ }
}

/* ===== Backup / importação ===== */
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
async function exportFile() {
  const ok = await shareOrDownload(new Blob([snapshot()], { type: 'application/json' }), `ushuaia2027-backup-${todayISO()}.json`, 'application/json');
  if (ok) { markBackup(); toast('Backup exportado.'); }
}
function summaryText() {
  const st = tripStats(), total = sumBRL(state.expenses), bal = balances();
  let t = `${state.settings.tripName.toUpperCase()} — RESUMO (${fmtDT(Date.now())})\n`;
  t += `Dias concluídos: ${st.nDone}/${st.act.length} • ${nf(st.done)} km rodados • faltam ${nf(st.remaining)} km\n`;
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
  const rows = [['data_hora', 'dia', 'categoria', 'descricao', 'valor', 'moeda', 'cotacao', 'valor_brl', 'pago_por', 'dividido_entre', 'litros', 'odometro', 'tanque_cheio']];
  [...state.expenses].sort((a, b) => a.ts - b.ts).forEach(e => rows.push([toLocalInput(e.ts).replace('T', ' '), dayNumber(e.dayId), CATS[e.category]?.label, e.desc, String(e.amount).replace('.', ','), e.currency,
    String(e.rate || '').replace('.', ','), String(Math.round(e.brl * 100) / 100).replace('.', ','), e.paidBy ? pName(e.paidBy) : '', (e.split || []).map(pName).join(' + '), e.liters || '', e.odo || '', e.category === 'abastecimento' ? (e.full ? 'sim' : 'não') : '']));
  const blob = new Blob(['﻿' + rows.map(r => r.map(q).join(';')).join('\r\n')], { type: 'text/csv' });
  await shareOrDownload(blob, `ushuaia2027-gastos-${todayISO()}.csv`, 'text/csv');
}
function mergeState(inc) {
  const m = migrate(inc);
  const addById = (mine, theirs) => theirs.forEach(x => { if (!mine.some(y => y.id === x.id)) mine.push(x); });
  addById(state.people, m.people); addById(state.expenses, m.expenses); addById(state.contacts, m.contacts); addById(state.extra, m.extra);
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

/* ===== Grupo / listas / contatos / SOS ===== */
function openContact(id) {
  const c = id ? state.contacts.find(x => x.id === id) : null, v = k => esc(c ? c[k] || '' : '');
  openModal(`<h2>${c ? 'Editar' : 'Novo'} contato</h2>
    <div class="fg"><label>Nome</label><input type="text" id="c-name" value="${v('name')}" placeholder="Seguradora, consulado, hotel…"></div>
    <div class="fg"><label>Telefone</label><input type="tel" id="c-phone" value="${v('phone')}" placeholder="+55 …"></div>
    <div class="fg"><label>Observação</label><input type="text" id="c-note" value="${v('note')}" placeholder="nº da apólice, horário…"></div>
    ${btns(B('saveContact', 'Salvar', 'ok', `data-id="${c ? c.id : ''}"`), B('closeModal', 'Cancelar', 'ghost'), c ? B('delContact', 'Excluir', 'danger', `data-id="${c.id}"`) : '')}`);
}
function openSetup() {
  openModal(`<h2>👋 Quem vai na viagem?</h2><p class="small muted" style="margin-bottom:8px">Um nome por linha. Você poderá adicionar ou tirar pessoas a qualquer momento na aba Grupo.</p>
    <div class="fg"><textarea id="s-names" placeholder="Fábio&#10;Piloto 2&#10;Piloto 3"></textarea></div>
    ${btns(B('setupGo', 'Começar', 'ok'), B('setupSkip', 'Pular (3 pilotos)', 'ghost'))}`);
}
function sosGo() {
  const out = $('sos-out');
  if (!navigator.geolocation) { out.innerHTML = '<p class="small neg">GPS indisponível neste navegador.</p>'; return; }
  out.innerHTML = '<p class="small muted">Buscando posição…</p>';
  navigator.geolocation.getCurrentPosition(p => {
    const { latitude: la, longitude: lo, accuracy } = p.coords;
    sosText = `SOS — preciso de ajuda. Posição: ${la.toFixed(5)}, ${lo.toFixed(5)} (±${Math.round(accuracy)} m) https://maps.google.com/?q=${la.toFixed(5)},${lo.toFixed(5)} — ${fmtDT(Date.now())}`;
    out.innerHTML = `<div class="sos" style="margin-top:8px">${esc(sosText)}</div>
      <div class="btnrow"><button class="btn" data-act="sosCopy">📋 Copiar</button><a class="btn" href="sms:?&body=${encodeURIComponent(sosText)}">💬 SMS</a><button class="btn ghost" data-act="sosShare">📤 Compartilhar</button></div>`;
  }, err => { out.innerHTML = `<p class="small neg">Não foi possível obter a posição (${esc(err.message)}). Verifique a permissão de localização.</p>`; },
  { enableHighAccuracy: true, timeout: 25000, maximumAge: 30000 });
}

/* ===== Ações (cliques) ===== */
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
    if (next === 'done') { const dd = getDay(d.id); if (dd.odoEnd == null) toast('Dia concluído. Registrar o odômetro?', 'Registrar', () => openOdo(d.id)); }
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
  saveExp: d => saveExpense(d.id || null),
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
  resetDates: () => { if (!confirm('Voltar todas as datas ao plano original?')) return; Object.values(state.days).forEach(o => delete o.date); save(); closeModal(); refresh(); },
  pushThis: d => { shiftFrom(d.id, 1); save(); closeModal(); refresh(); toast('Este dia e os seguintes foram empurrados +1 dia.'); },
  resetDay: d => { const o = ovr(d.id); ['origin', 'dest', 'km', 'date'].forEach(k => delete o[k]); save(); closeModal(); refresh(); },
  delDay: d => {
    if (!confirm('Excluir este dia extra? Os gastos lançados nele passam para o dia anterior.')) return;
    const idx = state.order.indexOf(d.id), fallback = state.order[idx - 1] || state.order[0];
    state.expenses.forEach(e => { if (e.dayId === d.id) e.dayId = fallback; });
    state.order.splice(idx, 1); state.extra = state.extra.filter(x => x.id !== d.id); delete state.days[d.id];
    save(); closeModal(); refresh();
  },
  toastAct: () => { const f = toastFn; $('toast').classList.remove('show'); if (f) f(); },
  chkp: d => { state.checks[d.key] = !state.checks[d.key]; if (!state.checks[d.key]) delete state.checks[d.key]; save(); renderLists(); },
  addItem: d => { const i = $('add-' + d.list), t = i.value.trim(); if (!t) return; (state.customItems[d.list] = state.customItems[d.list] || []).push({ id: 'c' + uid(), t }); save(); renderLists(); },
  delItem: d => { state.customItems[d.list] = (state.customItems[d.list] || []).filter(c => c.id !== d.id); save(); renderLists(); },
  addPerson: () => { const i = $('new-person'), n = i.value.trim(); if (!n) return toast('Digite o nome.'); state.people.push({ id: uid(), name: n, active: true }); save(); renderGroup(); renderHeader(); toast(`${n} entrou no grupo.`); },
  togglePerson: d => { const p = state.people.find(x => x.id === d.id); p.active = p.active === false; save(); renderGroup(); renderHeader(); },
  delPerson: d => { if (!confirm('Remover esta pessoa?')) return; state.people = state.people.filter(p => p.id !== d.id); save(); renderGroup(); renderHeader(); },
  exportFile: () => exportFile(),
  exportText: () => copyText(summaryText(), 'Resumo copiado — cole no WhatsApp.'),
  exportCsv: () => exportCsv(),
  importPick: () => $('importInput').click(),
  importDo: d => {
    const inc = pendingImport; pendingImport = null; if (!inc) return;
    if (d.mode === 'replace') state = migrate(inc); else mergeState(inc);
    save(); applyTheme(); closeModal(); refresh(); toast(d.mode === 'replace' ? 'Dados substituídos.' : 'Dados mesclados.');
  },
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
  setupGo: () => { const names = $('s-names').value.split('\n').map(s => s.trim()).filter(Boolean); finishSetup(names.length ? names : ['Piloto 1', 'Piloto 2', 'Piloto 3']); },
  setupSkip: () => finishSetup(['Piloto 1', 'Piloto 2', 'Piloto 3']),
  zerar: () => openModal(`<h2>🗑️ Apagar tudo?</h2><p class="small">Isso remove roteiro marcado, gastos, grupo, anotações e fotos <b>deste aparelho</b>. Faça um backup antes. Digite <b>ZERAR</b> para confirmar.</p>
    <div class="fg" style="margin-top:8px"><input type="text" id="z-conf" autocapitalize="characters"></div>${btns(B('zerarGo', 'Apagar', 'danger'), B('closeModal', 'Cancelar', 'ghost'))}`),
  zerarGo: async () => {
    if ($('z-conf').value.trim().toUpperCase() !== 'ZERAR') return toast('Digite ZERAR para confirmar.');
    try { if (IDB.db) { await IDB.clear('kv'); await IDB.clear('photos'); } localStorage.removeItem(LS_KEY); } catch (e) { /* ok */ }
    state = migrate(null); applyTheme(); closeModal(); refresh(); openSetup();
  },
  reloadApp: () => location.reload()
};
function finishSetup(names) {
  names.forEach(n => state.people.push({ id: uid(), name: n, active: true }));
  state.setupDone = true; save(); closeModal(); refresh();
}

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (fn) fn(el.dataset, el, ev);
});
document.addEventListener('input', ev => {
  if ($('sheet').contains(ev.target)) modalDirty = true;
  if (ev.target.dataset && ev.target.dataset.inp === 'xrecalc') recalcExpense();
});
document.addEventListener('change', ev => {
  const el = ev.target; if (!el.dataset) return;
  if ($('sheet').contains(el)) modalDirty = true;
  switch (el.dataset.chg) {
    case 'xrecalc': recalcExpense(); break;
    case 'tour': if (el.checked) state.checks[el.dataset.key] = true; else delete state.checks[el.dataset.key]; save(); el.closest('.tour').classList.toggle('dn', el.checked); break;
    case 'chkall': el.dataset.keys.split('|').forEach(k => { if (el.checked) state.checks[k] = true; else delete state.checks[k]; }); save(); renderLists(); break;
    case 'pname': { const p = state.people.find(x => x.id === el.dataset.id); if (p && el.value.trim()) { p.name = el.value.trim(); save(); renderHeader(); } break; }
    case 'pbike': { const p = state.people.find(x => x.id === el.dataset.id); if (p) { p.bike = el.value.trim(); save(); } break; }
    case 'setting': saveSetting(el); break;
  }
});
function saveSetting(el) {
  const S = state.settings, k = el.dataset.key, v = el.type === 'checkbox' ? el.checked : el.value.trim();
  if (k.startsWith('rate:')) { const n = num(v), c = k.slice(5); if (n > 0) S.rates[c] = n; else delete S.rates[c]; }
  else if (k === 'autonomy') { const n = num(v); S.autonomy = n > 0 ? n : 300; }
  else if (k === 'budget') { const n = num(v); S.budget = n > 0 ? n : 0; }
  else if (k === 'tripName') S.tripName = v || 'Diário de Bordo';
  else S[k] = v;
  save(); applyTheme(); renderHeader(); toast('Configuração salva.');
}
$('photoInput').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; handlePhoto(f); });
$('importInput').addEventListener('change', e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const obj = JSON.parse(r.result);
      if (obj.app !== 'ushuaia2027') throw new Error('arquivo inválido');
      pendingImport = obj;
      openModal(`<h2>📥 Importar backup</h2><p class="small">Arquivo com ${(obj.expenses || []).length} lançamentos e ${(obj.people || []).length} pessoas${obj.exportedAt ? ' (exportado em ' + fmtDT(obj.exportedAt) + ')' : ''}.</p>
        <p class="small muted" style="margin-top:6px"><b>Mesclar</b> mantém o que você já tem e acrescenta o que falta (ideal para juntar dados do grupo). <b>Substituir</b> troca tudo pelo conteúdo do arquivo.</p>
        ${btns(B('importDo', 'Mesclar', 'ok', 'data-mode="merge"'), B('importDo', 'Substituir', 'danger', 'data-mode="replace"'), B('closeModal', 'Cancelar', 'ghost'))}`);
    } catch (err) { toast('Arquivo inválido: não é um backup deste app.'); }
  };
  r.readAsText(f);
});
window.addEventListener('online', renderHeader);
window.addEventListener('offline', renderHeader);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (curView === 'more') renderMore(); });
matchMedia('(prefers-color-scheme: light)').addEventListener && matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => applyTheme());

/* ===== Service worker ===== */
function setupSW() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; location.reload(); });
  navigator.serviceWorker.register('sw.js').then(reg => {
    const watch = w => w && w.addEventListener('statechange', () => {
      if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Nova versão do app disponível.', 'Atualizar', () => w.postMessage('SKIP_WAITING'));
    });
    watch(reg.installing); reg.addEventListener('updatefound', () => watch(reg.installing));
    if (reg.waiting && navigator.serviceWorker.controller) toast('Nova versão do app disponível.', 'Atualizar', () => reg.waiting.postMessage('SKIP_WAITING'));
  }).catch(() => { /* sem offline */ });
}

/* ===== Inicialização ===== */
(async function init() {
  await loadState();
  applyTheme();
  renderHeader(); renderView();
  setupSW();
  if (!state.setupDone) openSetup();
  else setTimeout(() => { const id = currentDayId(); const el = id && $('day-' + id); if (el && hasData()) el.scrollIntoView({ block: 'start' }); }, 50);
  window.addEventListener('resize', () => document.documentElement.style.setProperty('--hdr', $('hdr').offsetHeight + 'px'));
})();
