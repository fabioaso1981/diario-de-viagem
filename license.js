'use strict';
/* ===== Planos e licença =====
   Gratuito: até 3 viagens, grupo de até 5 pessoas, 5 leituras por foto por mês, 1 roteiro pronto.
   Pro / Organizador: sem esses limites e com todos os roteiros prontos.
   O código de ativação é assinado (ECDSA P-256) e conferido neste aparelho, sem internet.
   Dados já criados NUNCA são apagados quando o plano vence: só se impede criar além do limite gratuito. */
const BUY_URL = ''; /* preencher com o link de compra (Hotmart, Kiwify, Mercado Pago…) quando existir */
const PRICE_TXT = 'R$ 49,00 por ano';
const FREE = { trips: 3, people: 5, ocr: 5 };
const TRIAL_DAYS = 14;
const PLAN_LABEL = { free: 'Gratuito', pro: 'Pro', org: 'Organizador' };
const LIC_PUB = { kty: 'EC', crv: 'P-256', x: 'L-RiRALWmAMqNbHElTq_xG4HgVTvcOQisZWXwRJnMSw', y: 'hGt-pot21FnxSQVWvhy05DbKUCLHqrNRN2aVUj3CARw' };

const fmtFull = s => s ? s.split('-').reverse().join('/') : '';
const b64uBytes = s => {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  const bin = atob(s), a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
};

/* ----- estado do plano ----- */
function licenseInfo() {
  const L = meta.license;
  if (L && L.plan && L.exp && L.exp >= todayISO()) return { plan: L.plan, kind: 'license', exp: L.exp, name: L.name || '' };
  const t = meta.trial;
  if (t && Date.now() < t.start + TRIAL_DAYS * 864e5) return { plan: 'pro', kind: 'trial', end: t.start + TRIAL_DAYS * 864e5 };
  return { plan: 'free', kind: L && L.exp ? 'expired' : 'none', exp: L && L.exp };
}
const planNow = () => licenseInfo().plan;
const isPaid = () => planNow() !== 'free';

/* ----- limites ----- */
const isEmptyTrip = s => !!s && !s.order.length && !s.expenses.length;
const tripsUsed = () => meta.trips.length - (isEmptyTrip(state) ? 1 : 0);
const canCreateTrip = () => isPaid() || tripsUsed() < FREE.trips;
const maxPeople = () => isPaid() ? Infinity : FREE.people;
function ocrMonth() {
  const m = todayISO().slice(0, 7);
  if (!meta.ocrUse || meta.ocrUse.m !== m) meta.ocrUse = { m, n: 0 };
  return meta.ocrUse;
}
const ocrLeft = () => isPaid() ? Infinity : Math.max(0, FREE.ocr - ocrMonth().n);
function ocrCount() { if (isPaid()) return; ocrMonth().n++; persist(); }

/* ----- código de ativação ----- */
async function verifyCode(code) {
  const parts = String(code || '').replace(/\s+/g, '').split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('formato');
  if (!(window.crypto && crypto.subtle)) throw new Error('crypto');
  const key = await crypto.subtle.importKey('jwk', LIC_PUB, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64uBytes(parts[1]), new TextEncoder().encode(parts[0]));
  if (!ok) throw new Error('assinatura');
  const p = JSON.parse(new TextDecoder().decode(b64uBytes(parts[0])));
  if (!['pro', 'org'].includes(p.p) || !/^\d{4}-\d{2}-\d{2}$/.test(p.e || '')) throw new Error('dados');
  return { plan: p.p, exp: p.e, id: p.i || '', name: p.n || '' };
}
async function activateCode() {
  const raw = $('lic-code').value.trim(), out = $('lic-msg');
  if (!raw) { out.textContent = 'Cole o código recebido.'; return; }
  try {
    const L = await verifyCode(raw);
    if (L.exp < todayISO()) { out.textContent = `Este código venceu em ${fmtFull(L.exp)}.`; return; }
    meta.license = { code: raw.replace(/\s+/g, ''), plan: L.plan, exp: L.exp, id: L.id, name: L.name };
    persist(); closeModal(); refresh();
    toast(`Plano ${PLAN_LABEL[L.plan]} ativo até ${fmtFull(L.exp)}.`);
  } catch (e) {
    out.textContent = e.message === 'crypto' ? 'Este navegador não consegue conferir o código. Use o app instalado, em https.' : 'Código inválido. Copie o código inteiro, sem espaços sobrando.';
  }
}
function startTrial() {
  if (meta.trial) return toast('O teste grátis já foi usado neste aparelho.');
  meta.trial = { start: Date.now() }; persist(); closeModal(); refresh();
  toast(`Teste grátis ativo por ${TRIAL_DAYS} dias.`);
}

/* ----- telas ----- */
const PAY_REASON = {
  trips: `O plano gratuito permite até ${FREE.trips} viagens.`,
  people: `O plano gratuito permite grupos de até ${FREE.people} pessoas.`,
  ocr: `Você usou as ${FREE.ocr} leituras por foto deste mês.`,
  routes: 'Este roteiro pronto faz parte do Pro.'
};
function openPaywall(reason) {
  const info = licenseInfo();
  openModal(`<h2>⭐ DiBordo Pro</h2>
    ${PAY_REASON[reason] ? `<p class="small" style="color:var(--amber);font-weight:700;margin-bottom:6px">${PAY_REASON[reason]}</p>` : ''}
    <div class="box"><b>Gratuito</b><div class="small muted">${FREE.trips} viagens • grupo de até ${FREE.people} pessoas • ${FREE.ocr} leituras por foto por mês • 1 roteiro pronto (Estrada Real)</div></div>
    <div class="box"><b>Pro — ${PRICE_TXT}</b><div class="small">Viagens ilimitadas • grupo sem limite • leitura por foto sem limite • 3 roteiros prontos (Ushuaia, Estrada Real e Jalapão)</div></div>
    <p class="small muted" style="margin:6px 0">Se o plano vencer, você continua vendo e usando tudo o que já criou. Só não dá para criar além do limite gratuito.</p>
    ${BUY_URL ? `<a class="btn amber block" href="${esc(BUY_URL)}" target="_blank" rel="noopener">Assinar o Pro</a>` : `<p class="small muted">A compra será liberada em breve. Já tem um código? Cole abaixo.</p>`}
    <div class="fg" style="margin-top:8px"><label>Código de ativação</label><textarea id="lic-code" placeholder="Cole aqui o código recebido" autocapitalize="off" autocomplete="off" spellcheck="false"></textarea></div>
    <p class="small neg" id="lic-msg"></p>
    ${btns(B('activateCode', 'Ativar código', 'ok'), !meta.trial && info.plan === 'free' ? B('startTrial', `Testar ${TRIAL_DAYS} dias grátis`, 'amber') : '', B('closeModal', 'Fechar', 'ghost'))}`);
}

function planCardHTML() {
  const info = licenseInfo();
  let st;
  if (info.kind === 'license') st = `✅ Plano <b>${PLAN_LABEL[info.plan]}</b> ativo até <b>${fmtFull(info.exp)}</b>.`;
  else if (info.kind === 'trial') st = `🎁 Teste grátis do Pro até <b>${new Date(info.end).toLocaleDateString('pt-BR')}</b>.`;
  else if (info.kind === 'expired') st = `⚠️ Seu plano venceu em <b>${fmtFull(info.exp)}</b>. Seus dados continuam aqui; só não dá para criar além do limite gratuito.`;
  else st = `Plano <b>Gratuito</b>: ${tripsUsed()} de ${FREE.trips} viagens • ${ocrLeft()} de ${FREE.ocr} leituras por foto neste mês.`;
  return `<div class="stage">Plano</div><div class="card"><p class="small">${st}</p>
    <div class="btnrow"><button class="btn amber" data-act="paywall">⭐ ${info.kind === 'license' ? 'Gerenciar plano' : 'Ver planos e ativar código'}</button><button class="btn" data-act="routes">📚 Roteiros prontos</button></div></div>`;
}
