'use strict';
/* ===== Helpers de formulário ===== */
const dayOptions = sel => orderedDays().map(d => `<option value="${d.id}" ${d.id === sel ? 'selected' : ''}>Dia ${dayNumber(d.id)} — ${esc(d.dest)}</option>`).join('');
function personOptions(sel, none) {
  return `<option value="">${none}</option>` + state.people.filter(p => p.active !== false || p.id === sel)
    .map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
}
function vehicleOptions(sel, none) {
  return `<option value="">${none}</option>` + state.vehicles.filter(v => v.active !== false || v.id === sel)
    .map(v => `<option value="${v.id}" ${v.id === sel ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
}
function ensureVehicles() {
  if (!vehiclesOn() || state.vehicles.length) return;
  if (state.mode === 'moto') activePeople().forEach(p => state.vehicles.push({ id: uid(), name: `Moto de ${p.name}`, active: true }));
  else state.vehicles.push({ id: uid(), name: modeOf().vname, active: true });
}
function oilToast() {
  const a = oilAlerts()[0];
  if (a) toast(`🔧 ${a.v.name}: ${a.level === 'overdue' ? 'troca de óleo e filtro VENCIDA' : `troca de óleo e filtro em ${nf(a.left)} km`}.`);
}

/* ===== Despesa ===== */
function openExpense(o = {}) {
  const old = o.id ? state.expenses.find(e => e.id === o.id) : null, S = state.settings, ppl = activePeople(), veh = vehiclesOn();
  const e = old ? { ...old } : { dayId: o.dayId || currentDayId() || state.order[0], ts: Date.now(), category: o.category || 'alimentacao', desc: o.desc || '',
    currency: S.lastCurrency || 'BRL', paidBy: S.lastPayer || (ppl.length === 1 ? ppl[0].id : ''), split: ppl.map(p => p.id), full: true, who: '' };
  if (!old && e.currency !== 'BRL') e.rate = S.rates[e.currency] || '';
  let auto = false;
  if (!old && e.category === 'abastecimento') {
    e.who = activeVehicles().some(v => v.id === S.lastVehicle) ? S.lastVehicle : refVehicleId();
    const v = state.vehicles.find(x => x.id === e.who), est = v ? vehicleOdo(v) : currentOdo();
    if (est) { e.odo = est; auto = true; }
  }
  ocrKeepBlob = null;
  const cats = Object.keys(CATS).filter(k => k !== 'abastecimento' || veh || e.category === 'abastecimento');
  const splitPeople = state.people.filter(p => p.active !== false || (e.split || []).includes(p.id));
  openModal(`<h2>${old ? 'Editar' : 'Novo'} lançamento</h2><input type="hidden" id="x-id" value="${old ? old.id : ''}">
    <div class="fgrid">
      <div class="fg"><label>Dia</label><select id="x-day">${dayOptions(e.dayId)}</select></div>
      <div class="fg"><label>Categoria</label><select id="x-cat" data-chg="xrecalc">${cats.map(k => `<option value="${k}" ${e.category === k ? 'selected' : ''}>${CATS[k].icon} ${CATS[k].label}</option>`).join('')}</select></div>
      <div class="fg"><label>Valor</label><input type="text" inputmode="decimal" id="x-amt" value="${old ? e.amount : ''}" placeholder="0,00" data-inp="xrecalc"></div>
      <div class="fg"><label>Moeda</label><select id="x-cur" data-chg="xrecalc">${CURRENCIES.map(c => `<option ${e.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    </div>
    <div class="fg ${e.currency === 'BRL' ? 'hidden' : ''}" id="x-ratebox"><label>Cotação: R$ por 1 <span id="x-curname">${esc(e.currency)}</span></label><input type="text" inputmode="decimal" id="x-rate" value="${e.rate || ''}" placeholder="ex.: 5,50" data-inp="xrecalc"></div>
    <div class="btnrow" style="margin:0 0 6px"><button class="btn sm ghost" data-act="ocrReceipt">📷 Ler cupom / recibo pela foto</button></div>
    <div id="x-ocr" class="box small hidden"></div>
    <label class="ck hidden" id="x-keepbox"><input type="checkbox" id="x-keep" checked> Guardar a foto do cupom no diário do dia</label>
    <p class="small muted" id="x-hint"></p>
    <div class="fuelbox ${e.category === 'abastecimento' ? '' : 'hidden'}" id="x-fuel">
      <div class="fgrid">
        <div class="fg"><label>Litros</label><input type="text" inputmode="decimal" id="x-liters" value="${e.liters || ''}" placeholder="13,8" data-inp="xrecalc"></div>
        <div class="fg"><label>Odômetro (km)</label><input type="text" inputmode="numeric" id="x-odo" value="${e.odo || ''}" placeholder="12345" data-auto="${auto ? 1 : 0}" data-inp="xrecalc"></div>
        <div class="fg"><label>Veículo</label><select id="x-who" data-chg="xwho">${vehicleOptions(e.who, '— não definido —')}</select></div>
        <div class="fg"><label>Km desde o último (se sem odômetro)</label><input type="text" inputmode="decimal" id="x-kmtrip" value="${e.kmTrip || ''}" data-inp="xrecalc"></div>
      </div>
      <div class="btnrow" style="margin:0 0 6px"><button class="btn sm ghost" data-act="ocrOdoX">📷 Ler odômetro pela foto do painel</button></div>
      <label class="ck"><input type="checkbox" id="x-full" data-chg="xrecalc" ${e.full ? 'checked' : ''}> Tanque cheio (necessário para calcular o km/L)</label>
      <p class="small" id="x-seg" style="color:var(--amber);font-weight:700"></p>
    </div>
    <div class="fg"><label>Descrição / local</label><input type="text" id="x-desc" value="${esc(e.desc || '')}" placeholder="Posto YPF, hotel, voo, almoço…"></div>
    <div class="fg"><label>Pago por</label><select id="x-paid">${personOptions(e.paidBy, '— não dividir —')}</select></div>
    <div class="fg"><label>Dividir entre</label><div class="chips" id="x-split">${splitPeople.map(p => `<label class="chip"><input type="checkbox" value="${p.id}" ${(e.split || []).includes(p.id) ? 'checked' : ''}><span>${esc(p.name)}</span></label>`).join('') || '<span class="small muted">Cadastre o grupo na aba Grupo.</span>'}</div></div>
    <div class="fg"><label>Data e hora</label><input type="datetime-local" id="x-ts" value="${toLocalInput(e.ts)}"></div>
    ${btns(B('saveExp', 'Salvar', 'ok'), B('closeModal', 'Cancelar', 'ghost'), old ? B('delExp', 'Excluir', 'danger', `data-id="${old.id}"`) : '')}`);
  recalcExpense();
}
function onWhoChange() {
  const odo = $('x-odo');
  if (!odo || odo.dataset.auto !== '1') return recalcExpense();
  const v = state.vehicles.find(x => x.id === $('x-who').value), est = v ? vehicleOdo(v) : currentOdo();
  odo.value = est || '';
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
  if (cat === 'abastecimento') {
    const p = fuelPreview({ id: $('x-id').value, who: $('x-who').value, odo: num($('x-odo').value), liters: lit, full: $('x-full').checked, kmTrip: num($('x-kmtrip').value) });
    let s = '';
    if (!(lit > 0)) s = '';
    else if (!p) s = 'Informe o odômetro (ou os km desde o último abastecimento) para ver o consumo do trecho.';
    else if (p.partial) s = 'Abastecimento parcial: o consumo é calculado no próximo tanque cheio.';
    else if (p.first) s = 'Primeiro tanque cheio deste veículo: serve de base. O km/L do trecho aparece no próximo abastecimento.';
    else s = `⛽ Trecho: ${nf(p.km)} km com ${nf(p.l, 1)} L → ${nf(p.km / p.l, 1)} km/L`;
    $('x-seg').textContent = s;
  }
}
function saveExpense() {
  const id = $('x-id').value || null, amount = num($('x-amt').value);
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
    if (odo > 0) { exp.odo = Math.round(odo); exp.refOdo = (!exp.who || exp.who === refVehicleId()) ? exp.odo : (currentOdo() || exp.odo); }
    if (kt > 0) exp.kmTrip = kt;
    if (exp.who) state.settings.lastVehicle = exp.who;
  }
  state.settings.lastPayer = paidBy; state.settings.lastCurrency = currency;
  const i = state.expenses.findIndex(e => e.id === exp.id);
  if (i >= 0) state.expenses[i] = exp; else state.expenses.push(exp);
  if ($('x-keep') && $('x-keep').checked && ocrKeepBlob && idbOk) { IDB.put('photos', { id: uid(), dayId: exp.dayId, ts: Date.now(), blob: ocrKeepBlob }).catch(() => { /* ok */ }); ocrKeepBlob = null; }
  save(); closeModal(); refresh();
  const seg = fuelStats().perEntry[exp.id];
  if (seg) toast(`Lançamento salvo • trecho de ${nf(seg.km)} km: ${nf(seg.km / seg.l, 1)} km/L`);
  else toast('Lançamento salvo.');
  if (category === 'abastecimento' || category === 'manutencao') setTimeout(oilToast, 2900);
}

/* ===== Odômetro, cidade de chegada ===== */
function setArrival(id, city) {
  const b = baseOf(id), o = ovr(id);
  if (city !== b.dest) o.dest = city; else delete o.dest;
  const vo = visibleOrder();
  for (let i = vo.indexOf(id) + 1; i < vo.length; i++) {
    const nd = state.days[vo[i]];
    if (nd && nd.status === 'skipped') continue;
    const nb = baseOf(vo[i]), no = ovr(vo[i]);
    if (city !== nb.origin) no.origin = city; else delete no.origin;
    break;
  }
}
function openOdo(id) {
  const d = getDay(id), showOdo = vehiclesOn() || state.mode === 'bike';
  let start = d.odoStart;
  if (start == null && showOdo) { const rv = state.vehicles.find(v => v.id === refVehicleId()); if (rv) start = vehicleOdo(rv); }
  openModal(`<h2>${showOdo ? '🔢 Odômetro' : '📏 Distância'} — Dia ${dayNumber(id)}</h2><p class="small muted">${esc(d.origin)} → ${esc(d.dest)}</p>
    ${showOdo ? `<div class="fgrid" style="margin-top:8px"><div class="fg"><label>Saída (km)</label><input type="text" inputmode="numeric" id="o-start" value="${start != null ? start : ''}"></div>
    <div class="fg"><label>Chegada (km)</label><input type="text" inputmode="numeric" id="o-end" value="${d.odoEnd != null ? d.odoEnd : ''}"></div></div>
    ${d.odoStartInherited ? '<p class="small muted">A saída veio da chegada do dia anterior.</p>' : ''}
    <div class="btnrow" style="margin:0 0 6px"><button class="btn sm ghost" data-act="ocrOdoD">📷 Ler odômetro pela foto do painel</button></div>
    <div id="o-ocr" class="box small hidden"></div>` : ''}
    <div class="fg" style="margin-top:6px"><label>${showOdo ? 'Km do dia (só se não tiver odômetro)' : 'Km percorridos a pé/no dia'}</label><input type="text" inputmode="decimal" id="o-km" value="${d.kmManual != null ? d.kmManual : ''}"></div>
    <div class="fg"><label>📍 Cidade de chegada (vira a saída do dia seguinte)</label><input type="text" id="o-city" value="${esc(d.dest)}"></div>
    <label class="ck"><input type="checkbox" id="o-done" ${d.status !== 'done' ? 'checked' : ''}> Marcar dia como concluído</label>
    ${btns(B('saveOdo', 'Salvar', 'ok', `data-id="${id}"`), B('closeModal', 'Cancelar', 'ghost'))}`);
}
function saveOdo(id) {
  const d = getDay(id), o = ovr(id), city = $('o-city').value.trim();
  const s = $('o-start') ? num($('o-start').value) : NaN, e = $('o-end') ? num($('o-end').value) : NaN, km = num($('o-km').value);
  if (!isNaN(s) && !isNaN(e) && e < s) return toast('A chegada não pode ser menor que a saída.');
  if ($('o-start')) {
    if (isNaN(s) || (d.odoStartInherited && s === d.odoStart)) delete o.odoStart; else o.odoStart = Math.round(s);
    if (isNaN(e)) delete o.odoEnd; else o.odoEnd = Math.round(e);
  }
  if (!isNaN(km) && km >= 0) o.kmManual = km; else delete o.kmManual;
  const hasEnd = !isNaN(e) || (!isNaN(km) && km > 0);
  if (hasEnd && $('o-done').checked && (o.status || 'pending') !== 'done') o.status = 'done';
  if (city) setArrival(id, city);
  save(); closeModal(); refresh(); toast(city ? `Salvo. ${city} é a saída do próximo dia.` : 'Salvo.');
  setTimeout(oilToast, 2900);
}

/* ===== Editar dia ===== */
function openDayEdit(id) {
  const d = getDay(id), h = d.hotel, f = (i, l, v, ph = '', t = 'text') => `<div class="fg"><label>${l}</label><input type="${t}" id="${i}" value="${esc(v == null ? '' : v)}" placeholder="${ph}"></div>`;
  openModal(`<h2>✏️ Dia ${dayNumber(id)}</h2>
    <div class="fgrid"><div class="fg"><label>Data real</label><input type="date" id="e-date" value="${d.date}"></div>
    <div class="fg"><label>Status</label><select id="e-status">${Object.keys(STATUS).map(s => `<option value="${s}" ${d.status === s ? 'selected' : ''}>${STATUS[s]}</option>`).join('')}</select></div></div>
    ${f('e-origin', 'Origem', d.origin)}${f('e-dest', 'Destino (onde dormiu / vai dormir)', d.dest)}
    <div class="fgrid">${f('e-km', 'Km previstos', d.km)}<div></div>${f('e-os', 'Odômetro saída', d.o.odoStart)}${f('e-oe', 'Odômetro chegada', d.odoEnd)}</div>
    <div class="fg"><label>Atrações / passeios extras (uma por linha: nome | custo)</label><textarea id="e-tours" placeholder="Museu do Fim do Mundo | USD 15">${esc(toursToText(d.o.tours))}</textarea></div>
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
  const km = num(v('e-km')); if (!isNaN(km) && km !== (b.km || 0)) o.km = km; else delete o.km;
  const os = num(v('e-os')), oe = num(v('e-oe'));
  if (!isNaN(os) && !isNaN(oe) && oe < os) return toast('A chegada não pode ser menor que a saída.');
  if (isNaN(os)) delete o.odoStart; else o.odoStart = Math.round(os);
  if (isNaN(oe)) delete o.odoEnd; else o.odoEnd = Math.round(oe);
  const st = $('e-status').value; if (st !== 'pending') o.status = st; else delete o.status;
  const tl = parseTours($('e-tours').value); if (tl.length) o.tours = tl; else delete o.tours;
  const hotel = { name: v('h-name'), addr: v('h-addr'), phone: v('h-phone'), conf: v('h-conf'), checkin: v('h-checkin'), coords: v('h-coords') };
  if (Object.values(hotel).some(Boolean)) o.hotel = hotel; else delete o.hotel;
  save(); closeModal(); refresh(); toast('Dia atualizado.');
}

/* ===== Anotações ===== */
const WX = sel => WEATHER.map(w => `<label class="chip"><input type="radio" name="l-wx" value="${w}" ${sel === w ? 'checked' : ''}><span>${w}</span></label>`).join('');
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

/* ===== Ajustar roteiro (datas e dias extras) ===== */
function shiftFrom(id, n) {
  const vo = visibleOrder();
  vo.slice(vo.indexOf(id)).forEach(x => { const d = getDay(x); ovr(x).date = addDaysISO(d.date, n); });
}
function addExtraDay(afterId, title, push) {
  const a = afterId ? getDay(afterId) : null, id = 'x' + uid();
  state.extra.push({ id, extra: true, stage: a ? a.stage : '', date: a ? (push ? addDaysISO(a.date, 1) : a.date) : todayISO(), origin: a ? a.dest : (title || 'Início'), dest: title || 'Dia extra',
    km: 0, time: '-', country: a ? a.country : '', highlights: 'Dia extra (imprevisto, descanso ou desvio).', gasWarning: false, tours: [], mapUrl: '' });
  state.order.splice(afterId ? state.order.indexOf(afterId) + 1 : 0, 0, id);
  if (a && push) { const vo = visibleOrder(), k = vo.indexOf(id); if (vo[k + 1]) shiftFrom(vo[k + 1], 1); }
  return id;
}
function openAdjust() {
  if (!state.order.length) return toast('Este roteiro ainda não tem dias.');
  const cur = currentDayId() || visibleOrder()[0];
  openModal(`<h2>⚙️ Ajustar roteiro</h2>
    <div class="card"><h3>⏩ Atrasou? Empurrar as datas</h3><p class="small muted">Desloca a data do dia escolhido e de todos os seguintes (negativo adianta).</p>
      <div class="fgrid" style="margin-top:6px"><div class="fg"><label>A partir do dia</label><select id="a-from">${dayOptions(cur)}</select></div>
      <div class="fg"><label>Dias</label><input type="text" inputmode="numeric" id="a-n" value="1"></div></div>
      ${B('applyPush', 'Aplicar', 'amber block')}</div>
    <div class="card"><h3>➕ Adicionar dia extra</h3><p class="small muted">Para pane, clima, descanso ou desvio. Entra depois do dia escolhido.</p>
      <div class="fg"><label>Depois do dia</label><select id="a-after">${dayOptions(cur)}</select></div>
      <div class="fg"><label>Descrição / local</label><input type="text" id="a-title" placeholder="Ex.: Parado em Río Gallegos (pneu)"></div>
      <label class="ck"><input type="checkbox" id="a-push" checked> Empurrar os dias seguintes +1</label>${B('addExtra', 'Adicionar dia extra', 'amber block')}</div>
    <div class="card"><h3>🔀 Mudou o roteiro?</h3><p class="small muted">Informe o novo caminho até o destino final, dia a dia.</p>${B('replan', 'Replanejar a partir de um dia', 'amber block')}
      ${state.replans.length ? B('undoReplan', '↩️ Desfazer o último replanejamento', 'ghost block', 'style="margin-top:8px"') : ''}</div>
    <div class="card"><h3>↩️ Voltar ao plano</h3>${B('resetDates', 'Restaurar todas as datas originais', 'ghost block')}</div>
    ${btns(B('closeModal', 'Fechar', 'ghost'))}`);
}

/* ===== Registro rápido / fotos ===== */
function openQuick() {
  if (!state.order.length) return toast('Crie ou adicione um dia primeiro.');
  const cur = currentDayId() || visibleOrder()[0], veh = vehiclesOn();
  openModal(`<h2>Registrar agora</h2><div class="fg"><label>Dia</label><select id="q-day">${dayOptions(cur)}</select></div>
    <div class="actions" style="grid-template-columns:1fr 1fr">
      <button class="btn amber" style="min-height:64px" data-act="qExp" data-cat="${veh ? 'abastecimento' : 'passagens'}">${veh ? '⛽ Abastecer' : '🎫 Passagem'}</button>
      <button class="btn amber" style="min-height:64px" data-act="qExp">💰 Gasto</button>
      <button class="btn" style="min-height:64px" data-act="qOdo">${veh || state.mode === 'bike' ? '🔢 Odômetro' : '📏 Distância'}</button>
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

/* ===== Contatos, primeira configuração, SOS ===== */
function openContact(id) {
  const c = id ? state.contacts.find(x => x.id === id) : null, v = k => esc(c ? c[k] || '' : '');
  openModal(`<h2>${c ? 'Editar' : 'Novo'} contato</h2>
    <div class="fg"><label>Nome</label><input type="text" id="c-name" value="${v('name')}" placeholder="Seguradora, consulado, hotel…"></div>
    <div class="fg"><label>Telefone</label><input type="tel" id="c-phone" value="${v('phone')}" placeholder="+55 …"></div>
    <div class="fg"><label>Observação</label><input type="text" id="c-note" value="${v('note')}" placeholder="nº da apólice, horário…"></div>
    ${btns(B('saveContact', 'Salvar', 'ok', `data-id="${c ? c.id : ''}"`), B('closeModal', 'Cancelar', 'ghost'), c ? B('delContact', 'Excluir', 'danger', `data-id="${c.id}"`) : '')}`);
}
function openSetup() {
  openModal(`<h2>👋 Bem-vindo!</h2>
    <div class="fg"><label>Como a viagem será feita?</label><select id="s-mode">${Object.keys(MODES).map(k => `<option value="${k}" ${state.mode === k ? 'selected' : ''}>${MODES[k].icon} ${MODES[k].label}</option>`).join('')}</select></div>
    <p class="small muted" style="margin-bottom:8px">Quem vai na viagem? Um nome por linha. Você poderá adicionar ou tirar pessoas a qualquer momento na aba Grupo.</p>
    <div class="fg"><textarea id="s-names" placeholder="Seu nome&#10;Outra pessoa (se houver)"></textarea></div>
    ${btns(B('setupGo', 'Começar', 'ok'), B('setupSkip', 'Pular (só eu)', 'ghost'))}`);
}
function finishSetup(names, mode) {
  state.mode = MODES[mode] ? mode : 'moto';
  if (names.length > maxPeople()) { names = names.slice(0, maxPeople()); toast(`O plano gratuito permite até ${FREE.people} pessoas. Os demais nomes ficaram de fora.`); }
  names.forEach(n => state.people.push({ id: uid(), name: n, active: true }));
  ensureVehicles();
  state.setupDone = true; save(); closeModal(); applyTheme(); refresh();
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
