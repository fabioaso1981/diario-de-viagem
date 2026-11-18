'use strict';
/* ===== Leitura de fotos (OCR) — cupom fiscal e painel/odômetro =====
   Usa Tesseract.js. Preferência: arquivos locais em vendor/tesseract/ (funciona offline).
   Sem eles, tenta a internet (CDN). Sempre mostra os números lidos para o usuário CONFERIR. */
let ocrKeepBlob = null, ocrCtx = null;
const OCR_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const OCR_LOCAL = 'vendor/tesseract/';

const OCR = {
  ready: null, mode: null,
  load() {
    if (this.ready) return this.ready;
    const loadScript = src => new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('falha ao carregar ' + src));
      document.head.appendChild(s);
    });
    this.ready = (async () => {
      if (window.Tesseract) { return; }
      try { await loadScript(OCR_LOCAL + 'tesseract.min.js'); this.mode = 'local'; }
      catch (e) {
        if (!navigator.onLine) throw new Error('offline-sem-leitor');
        await loadScript(OCR_CDN); this.mode = 'cdn';
      }
    })();
    this.ready.catch(() => { this.ready = null; });
    return this.ready;
  },
  async recognize(blob, digits, onProg) {
    const logger = m => { if (m.status === 'recognizing text' && onProg) onProg(m.progress); };
    let opts = { logger };
    if (this.mode === 'local') {
      const base = new URL(OCR_LOCAL, location.href).href;
      opts = { logger, workerPath: base + 'worker.min.js', corePath: base + 'core/', langPath: base + 'lang/', workerBlobURL: false, gzip: true, cacheMethod: 'none' };
    }
    const w = await Tesseract.createWorker('eng', 1, opts);
    try {
      await w.setParameters(digits
        ? { tessedit_char_whitelist: '0123456789 .,', tessedit_pageseg_mode: '11' }
        : { tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
      const r = await w.recognize(blob);
      return r.data.text || '';
    } finally { await w.terminate(); }
  }
};

/* Pré-processamento: escala de cinza, contraste automático e inversão para painéis escuros */
function loadImg(file) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); };
    img.src = url;
  });
}
async function prepImage(file, { max, min }) {
  const img = await loadImg(file), big = Math.max(img.width, img.height);
  let s = Math.min(1, max / big);
  if (big * s < min) s = min / big;
  const w = Math.round(img.width * s), h = Math.round(img.height * s);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h), a = d.data, hist = new Uint32Array(256);
  for (let i = 0; i < a.length; i += 4) { const g = (a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114) | 0; a[i] = a[i + 1] = a[i + 2] = g; hist[g]++; }
  const total = w * h; let lo = 0, hi = 255, acc = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= total * 0.02) { lo = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc >= total * 0.02) { hi = i; break; } }
  const rng = Math.max(1, hi - lo); let sum = 0;
  for (let i = 0; i < a.length; i += 4) { const v = Math.max(0, Math.min(255, ((a[i] - lo) * 255 / rng) | 0)); a[i] = a[i + 1] = a[i + 2] = v; sum += v; }
  if (sum / total < 110) for (let i = 0; i < a.length; i += 4) { a[i] = a[i + 1] = a[i + 2] = 255 - a[i]; }
  x.putImageData(d, 0, 0);
  return new Promise(res => c.toBlob(res, 'image/png'));
}

/* ===== Interpretação do texto ===== */
function parseReceipt(text) {
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const numRe = /\d{1,3}(?:\.\d{3})+,\d{2}|\d+[.,]\d{2,3}/g;
  const kwTotal = /total|a pagar|importe|valor\s*(?:total|pago)?|vlr|monto/i;
  const kwLit = /litro|\blts?\b|\bl\b|volume|\bvol\b|qtd|quant|cantidad/i;
  const kwUnit = /unit|pre[cç]o|precio|\/\s*l\b|r\$\s*\/\s*l/i;
  const totals = [], liters = [];
  const push = (arr, n, w) => {
    if (!(isFinite(n) && n > 0)) return;
    const f = arr.find(x => Math.abs(x.n - n) < 0.001);
    if (f) f.w = Math.max(f.w, w); else arr.push({ n, w });
  };
  lines.forEach(ln => {
    const raw = ln.match(numRe) || [], isUnit = kwUnit.test(ln);
    raw.forEach(r => {
      const n = num(r), dec = (r.split(/[.,]/).pop() || '').length;
      if (dec === 2 && !isUnit) push(totals, n, kwTotal.test(ln) ? 3 : (kwLit.test(ln) ? 0 : 1));
      if (!isUnit && n >= 1 && n <= 200 && dec >= 2 && (kwLit.test(ln) || dec === 3)) push(liters, n, kwLit.test(ln) ? 3 : 2);
    });
  });
  const rank = arr => arr.filter(x => x.w > 0 || arr.length < 4).sort((a, b) => b.w - a.w || b.n - a.n).slice(0, 5);
  return { totals: rank(totals).map(x => x.n), liters: liters.sort((a, b) => b.w - a.w || b.n - a.n).slice(0, 5).map(x => x.n),
    litKeyword: liters.some(x => x.w === 3), text };
}
function parseOdometer(text, ref) {
  const found = new Set(), kw = new Set();
  text.split(/\r?\n/).forEach(line => {
    const hasKm = /km|odo/i.test(line) && !/trip/i.test(line);
    (line.match(/\d[\d. ,]{1,10}\d/g) || []).forEach(s => { const d = s.replace(/\D/g, ''); if (d.length >= 3 && d.length <= 7) { found.add(+d); if (hasKm) kw.add(+d); } });
    (line.match(/\d{3,7}/g) || []).forEach(s => { found.add(+s); if (hasKm) kw.add(+s); });
  });
  const arr = [...found];
  if (ref) arr.sort((a, b) => { const sc = n => n >= ref - 5 ? n - ref : (ref - n) * 10; return sc(a) - sc(b); });
  else arr.sort((a, b) => (kw.has(b) - kw.has(a)) || String(b).length - String(a).length || b - a);
  return arr.slice(0, 5);
}

/* ===== Interface ===== */
const fmtMoney = n => n.toFixed(2).replace('.', ',');
const fmtLit = n => String(+n.toFixed(3)).replace('.', ',');
const ocrChips = (list, target, fmt) => list.map(n => `<button type="button" class="chip" data-act="ocrPick" data-target="${target}" data-v="${fmt(n)}">${fmt(n)}</button>`).join('');

function startOcr(ctx) { ocrCtx = ctx; $('ocrInput').click(); }
$('ocrInput').addEventListener('change', e => {
  const f = e.target.files[0]; e.target.value = '';
  if (f && ocrCtx) runOcr(f, ocrCtx);
});
async function runOcr(file, ctx) {
  const box = $(ctx.box); if (!box) return;
  box.classList.remove('hidden'); box.innerHTML = '⏳ Preparando a imagem…';
  try {
    const isOdo = ctx.kind === 'odo';
    if (ctx.kind === 'receipt') { try { ocrKeepBlob = await resizeImage(file, 1280); } catch (e) { ocrKeepBlob = null; } }
    const blob = await prepImage(file, isOdo ? { max: 1400, min: 900 } : { max: 1800, min: 1100 });
    box.innerHTML = '⏳ Carregando o leitor… (na primeira vez pode demorar)';
    await OCR.load();
    const text = await OCR.recognize(blob, isOdo, p => { box.innerHTML = `⏳ Lendo a foto… ${Math.round(p * 100)}%`; });
    if (isOdo) showOdoResult(box, ctx, text); else showReceiptResult(box, text);
  } catch (err) {
    box.innerHTML = err && err.message === 'offline-sem-leitor'
      ? '📵 O leitor de fotos não está instalado para uso offline neste aparelho. Digite os valores manualmente.'
      : '⚠️ Não consegui ler esta foto. Tente com mais luz e a foto de perto, ou digite manualmente.';
  }
}
function showReceiptResult(box, text) {
  const p = parseReceipt(text);
  if (!p.totals.length && !p.liters.length) {
    box.innerHTML = '⚠️ Não encontrei valores no cupom. Aproxime a câmera, evite reflexo e tente de novo — ou digite manualmente.';
    return;
  }
  if (p.totals.length) $('x-amt').value = fmtMoney(p.totals[0]);
  if (p.liters.length && p.litKeyword && vehiclesOn() && $('x-cat').value !== 'abastecimento') $('x-cat').value = 'abastecimento';
  if (p.liters.length && $('x-cat').value === 'abastecimento') $('x-liters').value = fmtLit(p.liters[0]);
  $('x-keepbox').classList.toggle('hidden', !ocrKeepBlob);
  recalcExpense();
  box.innerHTML = `✅ <b>Lido da foto — confira antes de salvar.</b>
    ${p.totals.length ? `<div class="chips"><span class="muted">Total:</span>${ocrChips(p.totals, 'x-amt', fmtMoney)}</div>` : ''}
    ${p.liters.length ? `<div class="chips"><span class="muted">Litros:</span>${ocrChips(p.liters, 'x-liters', fmtLit)}</div>` : ''}
    <details><summary class="muted">Texto lido</summary><pre style="white-space:pre-wrap;font-size:.7rem">${esc(text)}</pre></details>`;
}
function showOdoResult(box, ctx, text) {
  const ref = currentOdo(), list = parseOdometer(text, ref);
  if (!list.length) { box.innerHTML = '⚠️ Não encontrei o odômetro. Fotografe só o número, de perto e sem reflexo — ou digite manualmente.'; return; }
  const empty = ctx.targets.find(([id]) => $(id) && !$(id).value) || ctx.targets[0];
  const el = $(empty[0]);
  el.value = String(list[0]);
  if (el.dataset.auto) el.dataset.auto = '0';
  if (typeof recalcExpense === 'function' && $('x-cat')) recalcExpense();
  box.innerHTML = `✅ <b>Odômetro lido — confira.</b> Preenchi o campo "${empty[1]}" com ${nf(list[0])}.
    ${ctx.targets.map(([id, label]) => `<div class="chips"><span class="muted">${label}:</span>${list.map(n => `<button type="button" class="chip" data-act="ocrPick" data-target="${id}" data-v="${n}">${nf(n)}</button>`).join('')}</div>`).join('')}`;
}
async function updateOcrState() {
  const el = $('ocr-state'); if (!el) return;
  let local = false;
  try { const r = await fetch(OCR_LOCAL + 'tesseract.min.js', { method: 'HEAD' }); local = r.ok; } catch (e) { /* ok */ }
  el.textContent = local ? '✅ Leitor de fotos (cupom/painel) instalado para uso offline.'
    : 'ℹ️ Leitor de fotos (cupom/painel): funciona com internet. Para usar offline, instale os arquivos em vendor/tesseract (veja o LEIA-ME).';
}
