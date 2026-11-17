'use strict';
/* ===== Utilidades ===== */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const isNum = v => typeof v === 'number' && isFinite(v);
function num(v) {
  if (v == null) return NaN;
  let s = String(v).trim().replace(/\s/g, '');
  if (!s) return NaN;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) ? n : NaN;
}
const nf = (n, d = 0) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const BRL = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pad = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDaysISO = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return isoOf(d); };
const todayISO = () => isoOf(new Date());
const diffDays = (a, b) => Math.round((parseISO(a) - parseISO(b)) / 86400000);
function fmtDate(s) {
  if (!s) return '--';
  const d = parseISO(s);
  const w = d.toLocaleDateString('pt-BR', { weekday: 'long' }).split('-')[0];
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} (${w[0].toUpperCase() + w.slice(1)})`;
}
const fmtShort = s => { const d = parseISO(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
const fmtTime = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtDT = ts => { const d = new Date(ts); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${fmtTime(ts)}`; };
const toLocalInput = ts => { const d = new Date(ts); return `${isoOf(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fromLocalInput = v => { const t = new Date(v).getTime(); return isNaN(t) ? Date.now() : t; };

/* ===== Constantes ===== */
const CATS = {
  abastecimento: { label: 'Abastecimento', icon: '⛽', color: '#f59e0b' },
  alimentacao: { label: 'Alimentação', icon: '🍽️', color: '#10b981' },
  hospedagem: { label: 'Hospedagem', icon: '🏨', color: '#3b82f6' },
  passeios: { label: 'Passeios', icon: '🏔️', color: '#a855f7' },
  pedagios: { label: 'Pedágios/Balsa', icon: '🛣️', color: '#ec4899' },
  outros: { label: 'Outros', icon: '📦', color: '#94a3b8' }
};
const CURRENCIES = ['BRL', 'USD', 'ARS', 'CLP', 'UYU', 'EUR'];
const CUR_SYM = { BRL: 'R$', USD: 'US$', ARS: 'AR$', CLP: 'CL$', UYU: 'UY$', EUR: '€' };
const fmtCur = (n, c) => c === 'BRL' || !c ? BRL(n) : `${CUR_SYM[c] || c} ${nf(n, c === 'CLP' || c === 'ARS' ? 0 : 2)}`;
const STATUS = { pending: 'Pendente', doing: 'Em rota', done: 'Concluído', skipped: 'Pulado' };
const WEATHER = ['☀️', '⛅', '☁️', '🌧️', '💨', '❄️', '🌫️'];

/* ===== Persistência (IndexedDB + fallback localStorage) ===== */
const IDB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('sem IndexedDB'));
      const r = indexedDB.open('ushuaia2027', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('kv');
        d.createObjectStore('photos', { keyPath: 'id' }).createIndex('dayId', 'dayId');
      };
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  req(store, mode, fn) {
    return new Promise((res, rej) => {
      if (!this.db) return rej(new Error('db fechado'));
      const q = fn(this.db.transaction(store, mode).objectStore(store));
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
  },
  get: (s, k) => IDB.req(s, 'readonly', o => o.get(k)),
  put: (s, v, k) => IDB.req(s, 'readwrite', o => k === undefined ? o.put(v) : o.put(v, k)),
  del: (s, k) => IDB.req(s, 'readwrite', o => o.delete(k)),
  clear: s => IDB.req(s, 'readwrite', o => o.clear()),
  photosOf: dayId => IDB.req('photos', 'readonly', o => o.index('dayId').getAll(dayId))
};

const LS_KEY = 'ushuaia2027_state';
let state = null, idbOk = true;

const defaultState = () => ({
  app: 'ushuaia2027', v: 2, setupDone: false,
  people: [], days: {}, extra: [], order: TRIP.map(d => String(d.id)),
  expenses: [], checks: {}, customItems: {}, contacts: [],
  settings: { tripName: 'Expedição Ushuaia • Fin del Mundo', autonomy: 300, budget: 0, deadline: '', rates: {},
    theme: 'auto', gloves: false, lastBackup: 0, lastPayer: '', lastCurrency: 'BRL' }
});

function migrate(saved) {
  const d = defaultState();
  if (!saved || typeof saved !== 'object') return d;
  const s = Object.assign(d, saved);
  s.settings = Object.assign(defaultState().settings, saved.settings || {});
  ['people', 'extra', 'order', 'expenses', 'contacts'].forEach(k => { if (!Array.isArray(s[k])) s[k] = d[k]; });
  ['days', 'checks', 'customItems'].forEach(k => { if (!s[k] || typeof s[k] !== 'object') s[k] = {}; });
  TRIP.forEach(t => { if (!s.order.includes(String(t.id))) s.order.push(String(t.id)); });
  return s;
}

async function loadState() {
  let saved = null;
  try { await IDB.open(); saved = await IDB.get('kv', 'state'); } catch (e) { idbOk = false; }
  if (!saved) { try { saved = JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) { saved = null; } }
  state = migrate(saved);
}

let saveT = null;
function save() { clearTimeout(saveT); saveT = setTimeout(persist, 250); }
function persist() {
  clearTimeout(saveT);
  if (!state) return;
  if (idbOk && IDB.db) IDB.put('kv', JSON.parse(JSON.stringify(state)), 'state').catch(() => { idbOk = false; });
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* storage cheio/bloqueado */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(); });
window.addEventListener('pagehide', persist);

/* ===== Dias (plano + ajustes do usuário) ===== */
const baseById = {};
TRIP.forEach(d => { baseById[String(d.id)] = d; });
const baseOf = id => baseById[id] || state.extra.find(x => x.id === id);
const ovr = id => state.days[id] || (state.days[id] = {});

function getDay(id) {
  const b = baseOf(id);
  if (!b) return null;
  const o = state.days[id] || {};
  return {
    id, base: b, o, stage: b.stage,
    origin: o.origin || b.origin, dest: o.dest || b.dest,
    km: isNum(o.km) ? o.km : b.km, time: b.time, country: b.country,
    highlights: b.highlights, gasWarning: b.gasWarning, tours: b.tours || [],
    date: o.date || b.date, planDate: b.date, status: o.status || 'pending',
    odoStart: isNum(o.odoStart) ? o.odoStart : null, odoEnd: isNum(o.odoEnd) ? o.odoEnd : null,
    hotel: o.hotel || {}, log: o.log || [], isExtra: !!b.extra,
    changedRoute: !!(o.origin || o.dest)
  };
}
const orderedDays = () => state.order.map(getDay).filter(Boolean);
const dayNumber = id => state.order.indexOf(id) + 1;
function mapLink(d) {
  if (d.changedRoute || !d.base.mapUrl)
    return 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(d.origin) + '&destination=' + encodeURIComponent(d.dest);
  return d.base.mapUrl;
}
function currentDayId() {
  const days = orderedDays();
  const doing = days.find(d => d.status === 'doing');
  if (doing) return doing.id;
  const p = days.find(d => d.status === 'pending');
  return p ? p.id : null;
}
const realKm = d => (d.odoStart != null && d.odoEnd != null && d.odoEnd >= d.odoStart) ? d.odoEnd - d.odoStart : null;

function currentOdo() {
  let m = 0;
  orderedDays().forEach(d => { if (d.odoStart != null) m = Math.max(m, d.odoStart); if (d.odoEnd != null) m = Math.max(m, d.odoEnd); });
  state.expenses.forEach(e => { if (isNum(e.odo) && e.odo > m) m = e.odo; });
  return m || null;
}

function tripStats() {
  const days = orderedDays(), act = days.filter(d => d.status !== 'skipped'), co = currentOdo();
  let done = 0, remaining = 0, nDone = 0, rDays = 0, rSum = 0;
  act.forEach(d => {
    const r = realKm(d);
    if (d.status === 'done') {
      nDone++;
      done += r != null ? r : (d.km || 0);
      if (r > 0) { rDays++; rSum += r; }
    } else if (d.status === 'doing') {
      let part = 0;
      if (d.odoStart != null && co != null && co > d.odoStart) part = co - d.odoStart;
      if (r != null) part = r;
      done += part; remaining += Math.max(0, (d.km || 0) - part);
    } else remaining += d.km || 0;
  });
  const total = done + remaining;
  const last = act[act.length - 1];
  const arrival = last ? last.date : null;
  const dl = state.settings.deadline;
  return {
    days, act, nDone, done, remaining, total, pct: total > 0 ? Math.min(100, Math.round(done / total * 100)) : 0,
    pace: rDays ? rSum / rDays : null, arrival, slack: dl && arrival ? diffDays(dl, arrival) : null
  };
}

/* ===== Grupo, despesas, consumo ===== */
const activePeople = () => state.people.filter(p => p.active !== false);
const pName = id => { const p = state.people.find(x => x.id === id); return p ? p.name : '—'; };
const dayExpenses = id => state.expenses.filter(e => e.dayId === id).sort((a, b) => a.ts - b.ts);
const sumBRL = list => list.reduce((a, e) => a + (e.brl || 0), 0);

function fuelStats() {
  const fuels = state.expenses.filter(e => e.category === 'abastecimento');
  const perEntry = {}, byWho = {}; let km = 0, l = 0;
  const add = (who, k, lit, id) => {
    const key = who || '_';
    const g = byWho[key] || (byWho[key] = { km: 0, l: 0 });
    g.km += k; g.l += lit; km += k; l += lit; perEntry[id] = { km: k, l: lit };
  };
  const groups = {};
  fuels.forEach(e => {
    if (e.odo > 0) (groups[e.who || '_'] = groups[e.who || '_'] || []).push(e);
    else if (e.kmTrip > 0 && e.liters > 0) add(e.who, e.kmTrip, e.liters, e.id);
  });
  Object.values(groups).forEach(arr => {
    arr.sort((a, b) => a.odo - b.odo || a.ts - b.ts);
    let prev = null, acc = 0;
    arr.forEach(e => {
      if (prev) acc += e.liters || 0;
      if (e.full) {
        if (prev && acc > 0 && e.odo > prev.odo) add(e.who, e.odo - prev.odo, acc, e.id);
        prev = e; acc = 0;
      }
    });
  });
  return { perEntry, byWho, km, l };
}

function lastFuelInfo() {
  const arr = state.expenses.filter(e => e.category === 'abastecimento' && e.odo > 0);
  if (!arr.length) return null;
  arr.sort((a, b) => b.ts - a.ts);
  const co = currentOdo(), since = Math.max(0, (co || arr[0].odo) - arr[0].odo);
  return { since, left: (state.settings.autonomy || 0) - since, entry: arr[0] };
}

function balances() {
  const b = {};
  state.people.forEach(p => { b[p.id] = { paid: 0, share: 0 }; });
  state.expenses.forEach(e => {
    if (!e.paidBy || !e.split || !e.split.length || !b[e.paidBy]) return;
    b[e.paidBy].paid += e.brl || 0;
    const s = (e.brl || 0) / e.split.length;
    e.split.forEach(id => { if (b[id]) b[id].share += s; });
  });
  return b;
}
function settlements(b) {
  const cred = [], deb = [];
  Object.entries(b).forEach(([id, v]) => {
    const n = v.paid - v.share;
    if (n > 0.5) cred.push({ id, n }); else if (n < -0.5) deb.push({ id, n: -n });
  });
  cred.sort((x, y) => y.n - x.n); deb.sort((x, y) => y.n - x.n);
  const out = []; let i = 0, j = 0;
  while (i < deb.length && j < cred.length) {
    const t = Math.min(deb[i].n, cred[j].n);
    out.push({ from: deb[i].id, to: cred[j].id, v: t });
    deb[i].n -= t; cred[j].n -= t;
    if (deb[i].n < 0.5) i++;
    if (cred[j].n < 0.5) j++;
  }
  return out;
}

/* Orçamento planejado de passeios (USD) a partir do texto "USD 80 - 120" */
function plannedToursUSD() {
  let min = 0, max = 0;
  orderedDays().forEach(d => {
    if (d.status === 'skipped') return;
    d.tours.forEach(t => {
      const m = /USD\s*(\d+)(?:\s*-\s*(\d+))?/i.exec(t.cost || '');
      if (m) { min += +m[1]; max += +(m[2] || m[1]); }
    });
  });
  return { min, max };
}
