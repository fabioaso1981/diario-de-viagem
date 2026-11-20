'use strict';
/* ===== Roteiros prontos =====
   tier 'free' = vem no plano gratuito; 'pro' = exige Pro ou Organizador (ou o teste grátis).
   Distâncias e atrações são aproximadas: servem de ponto de partida. */
const ROUTES_AVISO = 'Distâncias e atrações são aproximadas, montadas como ponto de partida. Confira estradas, combustível, clima e documentos antes de viajar.';
const ROUTES = [
  {
    id: 'estrada-real', tier: 'free', mode: 'moto', name: 'Brasília → Estrada Real → Brasília', start: 'Brasília-DF',
    resumo: 'Cidades históricas de Minas: Ouro Preto, Mariana, Tiradentes e São João del-Rei.',
    rows: [
      { city: 'Belo Horizonte-MG', km: 740, stay: 0, tours: '', note: 'Dia longo de rodovia (BR-040). Saia cedo.' },
      { city: 'Ouro Preto-MG', km: 100, stay: 1, tours: 'Centro histórico e Praça Tiradentes\nIgreja de São Francisco de Assis\nMina do Chico Rei\nMariana: Mina da Passagem', note: '' },
      { city: 'Tiradentes-MG', km: 190, stay: 1, tours: 'Centro histórico de Tiradentes\nPasseio de Maria Fumaça (São João del-Rei a Tiradentes)\nSão João del-Rei: igrejas e museus', note: '' },
      { city: 'Belo Horizonte-MG', km: 200, stay: 0, tours: '', note: '' },
      { city: 'Brasília-DF', km: 740, stay: 0, tours: '', note: 'Dia longo de rodovia (BR-040). Saia cedo.' }
    ]
  },
  {
    id: 'jalapao', tier: 'pro', mode: 'moto', name: 'Goiânia → Mateiros (Jalapão) → Palmas → Goiânia', start: 'Goiânia-GO',
    resumo: 'Fervedouros, dunas e cachoeiras no Jalapão, com dias de descanso em Palmas.',
    rows: [
      { city: 'Palmas-TO', km: 870, stay: 0, tours: '', note: 'Dia muito longo (BR-153). Considere dividir a viagem em Gurupi-TO.' },
      { city: 'Mateiros-TO', km: 330, stay: 4, tours: 'Fervedouro do Ceiça\nFervedouro Bela Vista\nDunas do Jalapão (pôr do sol)\nCachoeira da Velha\nPedra Furada\nCachoeira do Formiga', note: 'Trechos de terra e areia: leve combustível extra, confirme os postos e evite rodar à noite.' },
      { city: 'Palmas-TO', km: 340, stay: 2, tours: 'Praia da Graciosa\nPraça dos Girassóis\nTaquaruçu: cachoeiras', note: '' },
      { city: 'Goiânia-GO', km: 870, stay: 0, tours: '', note: 'Dia muito longo (BR-153).' }
    ]
  },
  {
    id: 'ushuaia', tier: 'pro', mode: 'moto', name: 'Goiânia → Ushuaia → Goiânia', template: 'ushuaia',
    resumo: 'Expedição completa até o fim do mundo, com fronteiras, trechos sem posto e passeios na Patagônia.'
  }
];

const routeById = id => ROUTES.find(r => r.id === id);
const routeDays = r => r.template ? TRIP.length : r.rows.length + r.rows.reduce((a, x) => a + (x.stay || 0), 0);
const routeKm = r => r.template ? TRIP.reduce((a, d) => a + (d.km || 0), 0) : r.rows.reduce((a, x) => a + (x.km || 0), 0);
const routeLocked = r => !(r.tier === 'free' || isPaid());

function openRoutes() {
  const free = ROUTES.filter(r => r.tier === 'free').length;
  openModal(`<h2>📚 Roteiros prontos</h2>
    <p class="small muted" style="margin-bottom:8px">Escolha um roteiro, ajuste as datas e use como base. ${isPaid() ? 'Todos liberados no seu plano.' : `O plano gratuito inclui ${free} roteiro; os outros fazem parte do Pro.`}</p>` +
    ROUTES.map(r => {
      const m = MODES[r.mode], lock = routeLocked(r);
      return `<div class="cat"><div><b>${lock ? '🔒 ' : ''}${esc(r.name)}</b>
        <div class="small muted">${m.icon} ${routeDays(r)} dias • cerca de ${nf(routeKm(r))} km${r.tier === 'free' ? ' • grátis' : ''}</div>
        <div class="small muted">${esc(r.resumo)}</div></div>
        <div class="row">${B('routePrev', lock ? 'Prévia' : 'Ver', 'sm', `data-id="${r.id}"`)}</div></div>`;
    }).join('') +
    `<p class="small muted" style="margin-top:8px">${ROUTES_AVISO}</p>` + btns(B('closeModal', 'Fechar', 'ghost')));
}

function openRoutePreview(id) {
  const r = routeById(id); if (!r) return;
  const lock = routeLocked(r);
  let legs;
  if (r.template) {
    legs = TRIP.map(d => `${d.origin} → ${d.dest}${d.km ? ` (${nf(d.km)} km)` : ''}`);
  } else {
    legs = []; let prev = r.start;
    r.rows.forEach(x => {
      legs.push(`${prev} → ${x.city}${x.km ? ` (${nf(x.km)} km)` : ''}`);
      for (let k = 0; k < (x.stay || 0); k++) legs.push(`Dia em ${x.city}${k === 0 ? ' — atrações' : ''}`);
      prev = x.city;
    });
  }
  openModal(`<h2>${lock ? '🔒 ' : ''}${esc(r.name)}</h2>
    <p class="small muted">${MODES[r.mode].icon} ${routeDays(r)} dias • cerca de ${nf(routeKm(r))} km</p>
    <p class="small" style="margin:6px 0">${esc(r.resumo)}</p>
    <div class="box">${legs.map((t, i) => `<div class="small" style="padding:2px 0"><b>Dia ${i + 1}</b> — ${esc(t)}</div>`).join('')}</div>
    <p class="small muted" style="margin-top:8px">${ROUTES_AVISO}</p>` +
    btns(lock ? B('paywallRoutes', '⭐ Desbloquear com o Pro', 'amber') : B('routeUse', 'Usar este roteiro', 'ok', `data-id="${r.id}"`), B('routes', 'Voltar', 'ghost')));
}

function openRouteUse(id) {
  const r = routeById(id); if (!r) return;
  if (routeLocked(r)) return openPaywall('routes');
  if (!canCreateTrip()) return openPaywall('trips');
  openModal(`<h2>Usar roteiro</h2>
    <p class="small muted" style="margin-bottom:8px">${esc(r.name)} • ${routeDays(r)} dias</p>
    <div class="fg"><label>Nome da viagem</label><input type="text" id="rt-name" value="${esc(r.name)}"></div>
    ${r.template ? `<p class="small muted">As datas vêm de um exemplo (a partir de 23/01/2027). Depois ajuste em <b>Ajustar roteiro</b>.</p>`
      : `<div class="fg"><label>Data de saída</label><input type="date" id="rt-date" value="${todayISO()}"></div>`}
    <label class="ck"><input type="checkbox" id="rt-same" checked> Usar o mesmo grupo (e veículos) da viagem atual</label>
    ${btns(B('routeGo', 'Criar viagem', 'ok', `data-id="${r.id}"`), B('routes', 'Voltar', 'ghost'))}`);
}

async function routeCreate(id) {
  const r = routeById(id); if (!r) return;
  if (routeLocked(r)) return openPaywall('routes');
  if (!canCreateTrip()) return openPaywall('trips');
  const name = $('rt-name').value.trim() || r.name, same = $('rt-same').checked;
  if (r.template) {
    if (meta.trips.some(t => t.id === 'ushuaia')) { closeModal(); return openTripById('ushuaia'); }
    const st = defaultState('ushuaia', r.mode, name);
    st.setupDone = true;
    if (same) copyGroupInto(st);
    await activateTrip(st);
    return toast(`Viagem criada: ${st.order.length} dias.`);
  }
  const sd = $('rt-date').value; if (!sd) return toast('Informe a data de saída.');
  const st = buildTripFromPlan({ name, mode: r.mode, start: r.start, startDate: sd, endDate: '', same, rows: r.rows });
  await activateTrip(st);
  toast(`Viagem criada: ${st.order.length} dias. Confira as distâncias antes de sair.`);
}
