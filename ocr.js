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
  opts(logger) {
    if (this.mode === 'local') {
      const base = new URL(OCR_LOCAL, location.href).href;
      return { logger, workerPath: base + 'worker.min.js', corePath: base + 'core/', langPath: base + 'lang/', workerBlobURL: false, gzip: true, cacheMethod: 'none' };
    }
    return { logger };
  },
  /* Abre um leitor, aplica os parâmetros e entrega para fn(w); fecha no fim (reaproveita o mesmo leitor em várias tentativas) */
  async withWorker(params, fn, onProg) {
    const logger = m => { if (m.status === 'recognizing text' && onProg) onProg(m.progress); };
    const w = await Tesseract.createWorker('eng', 1, this.opts(logger));
    try { await w.setParameters(params); return await fn(w); } finally { await w.terminate(); }
  },
  async recognize(blob, digits, onProg) {
    const params = digits
      ? { tessedit_char_whitelist: '0123456789 .,', tessedit_pageseg_mode: '11' }
      : { tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' };
    return this.withWorker(params, async w => (await w.recognize(blob)).data.text || '', onProg);
  }
};

/* Gira a foto (graus) e reduz; o leitor só entende texto na horizontal, e painéis costumam sair inclinados */
async function rotateImage(file, deg, max) {
  const img = await loadImg(file), r = deg * Math.PI / 180;
  const s = Math.min(1, max / Math.max(img.width, img.height)), w = img.width * s, h = img.height * s;
  const W = Math.ceil(Math.abs(w * Math.cos(r)) + Math.abs(h * Math.sin(r))), H = Math.ceil(Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r)));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  x.translate(W / 2, H / 2); x.rotate(r); x.drawImage(img, -w / 2, -h / 2, w, h);
  return new Promise(res => c.toBlob(res, 'image/png'));
}
const ODO_KM = /(\d{1,3}(?:[. ]\d{3})+|\d{3,7})\s*km(?!\s*\/|\s*h)/i;
/* Odômetro: tenta a foto em vários ângulos até achar "NNNN km" (para ao primeiro acerto) */
async function readOdoRotating(file, box) {
  const angles = [0, 60, -60, 75, -75, 30, -30, 45, -45, 90, -90];
  let found = '';
  await OCR.withWorker({ tessedit_pageseg_mode: '11', preserve_interword_spaces: '1' }, async w => {
    for (let i = 0; i < angles.length && !found; i++) {
      box.innerHTML = `⏳ Lendo a foto… (tentativa ${i + 1} de ${angles.length})`;
      const t = (await w.recognize(await rotateImage(file, angles[i], 1100))).data.text || '';
      if (ODO_KM.test(t)) found = t;
    }
  });
  return found;
}
/* Display LCD da bomba: acha a caixa clara azulada, lê a linha de baixo (litros) e a de cima (total) com vários cortes de contraste.
   O reflexo no vidro costuma atrapalhar o total; por isso só aceita valores que se repetem e fazem sentido. */
async function readPumpLcd(file, box) {
  const img = await loadImg(file), s0 = Math.min(1, 1000 / Math.max(img.width, img.height));
  const W = Math.round(img.width * s0), H = Math.round(img.height * s0);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, W, H);
  const a = x.getImageData(0, 0, W, H).data, m = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < a.length; i += 4, p++) { const r = a[i], g = a[i + 1], b = a[i + 2]; if (g > 170 && b > 170 && g - r > 25 && Math.abs(g - b) < 30) m[p] = 1; }
  const seen = new Uint8Array(W * H); let best = null;
  for (let p = 0; p < W * H; p++) {
    if (!m[p] || seen[p]) continue;
    let x0 = W, y0 = H, x1 = 0, y1 = 0, cnt = 0; const st = [p]; seen[p] = 1;
    while (st.length) {
      const q = st.pop(), qx = q % W, qy = (q / W) | 0; cnt++;
      if (qx < x0) x0 = qx; if (qx > x1) x1 = qx; if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
      if (qx + 1 < W && m[q + 1] && !seen[q + 1]) { seen[q + 1] = 1; st.push(q + 1); }
      if (qx > 0 && m[q - 1] && !seen[q - 1]) { seen[q - 1] = 1; st.push(q - 1); }
      if (qy + 1 < H && m[q + W] && !seen[q + W]) { seen[q + W] = 1; st.push(q + W); }
      if (qy > 0 && m[q - W] && !seen[q - W]) { seen[q - W] = 1; st.push(q - W); }
    }
    if (cnt > W * H * 0.02 && (!best || cnt > best.cnt)) best = { x0, y0, x1, y1, cnt };
  }
  if (!best) return null;
  box.innerHTML = '⏳ Lendo o display da bomba…';
  const bw = best.x1 - best.x0, bh = best.y1 - best.y0;
  const rowBlob = (row, thr) => {
    const sx = best.x0 + bw * 0.3, sw = bw * 0.72, y0 = best.y0 + (row === 0 ? 0 : bh * 0.5) - 4, hh = bh * 0.5 + 8, k = 700 / sw;
    const cc = document.createElement('canvas'); cc.width = Math.round(sw * k); cc.height = Math.round(hh * k);
    const cx = cc.getContext('2d', { willReadFrequently: true }); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cc.width, cc.height);
    cx.drawImage(img, sx / s0, y0 / s0, sw / s0, hh / s0, 0, 0, cc.width, cc.height);
    const d = cx.getImageData(0, 0, cc.width, cc.height), q = d.data;
    for (let i = 0; i < q.length; i += 4) { const g = q[i] * 0.299 + q[i + 1] * 0.587 + q[i + 2] * 0.114; const v = thr ? (g > thr ? 255 : 0) : g; q[i] = q[i + 1] = q[i + 2] = v; }
    cx.putImageData(d, 0, 0);
    return new Promise(res => cc.toBlob(res, 'image/png'));
  };
  const votes = [{}, {}];
  await OCR.withWorker({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: '0123456789.,' }, async w => {
    for (const row of [1, 0]) for (const thr of [0, 100, 130, 160]) {
      const d = ((await w.recognize(await rowBlob(row, thr))).data.text || '').replace(/\D/g, '');
      if (d.length >= 3 && d.length <= 6) votes[row][d] = (votes[row][d] || 0) + 1;
    }
  });
  const top = v => Object.entries(v).sort((p, q) => q[1] - p[1])[0];
  const l = top(votes[1]), t = top(votes[0]);
  const lit = l && l[1] >= 2 ? +l[0] / 1000 : 0;
  let tot = t && t[1] >= 2 ? +t[0] / 100 : 0;
  if (!(lit >= 0.5 && lit <= 150)) return null;
  if (tot && !(tot / lit >= 3 && tot / lit <= 15)) tot = 0;
  return (tot ? `TOTAL A PAGAR R$ ${fmtMoney(tot)}\n` : '') + `LITROS ${fmtLit(lit)} L combustivel\n(lido do display da bomba)`;
}

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
  const kwLit = /litro|\blts?\b|\bl\b|\d\s*l\b|volume|\bvol\b|qtd|quant|cantidad/i;
  const kwUnit = /unit|pre[cç]o|precio|\/\s*l\b|r\$\s*\/\s*l/i;
  const totals = [], liters = [];
  const push = (arr, n, w) => {
    if (!(isFinite(n) && n > 0)) return;
    const f = arr.find(x => Math.abs(x.n - n) < 0.001);
    if (f) f.w = Math.max(f.w, w); else arr.push({ n, w });
  };
  lines.forEach(ln => {
    const isUnit = kwUnit.test(ln), re = new RegExp(numRe.source, 'g'); let mm;
    while ((mm = re.exec(ln))) {
      const r = mm[0], n = num(r), dec = (r.split(/[.,]/).pop() || '').length;
      const money = /(?:R\s*\$|RS)\s*$/i.test(ln.slice(Math.max(0, mm.index - 4), mm.index));   // "R$ 148,01" é valor, não litros
      const withL = /^\s*l\b/i.test(ln.slice(mm.index + r.length));                              // "21,18L" / "21,175 L"
      if (dec === 2 && !isUnit) push(totals, n, kwTotal.test(ln) ? 3 : (kwLit.test(ln) ? 0 : 1));
      if (!isUnit && !money && n >= 1 && n <= 200 && dec >= 2 && (kwLit.test(ln) || dec === 3)) push(liters, n, withL ? 4 : (kwLit.test(ln) ? 3 : 2));
    }
  });
  const rank = arr => arr.filter(x => x.w > 0 || arr.length < 4).sort((a, b) => b.w - a.w || b.n - a.n).slice(0, 5);
  /* só é combustível se aparecer um produto (gasolina, etanol, diesel…) ou um volume com "L" (ex.: 21,175 L);
     "Qtde" e "1,00 UN" de um lanche não contam */
  const isFuel = /gasol|solina|etanol|[aá]lcool|diesel|\bgnv\b|combust[ií]v|\bs-?10\b|\bs-?500\b|aditiv|petrobras|ipiranga/i.test(text) || /\d[.,]\d{3}\s*l\b/i.test(text);
  return { totals: rank(totals).map(x => x.n), liters: isFuel ? liters.sort((a, b) => b.w - a.w || b.n - a.n).slice(0, 5).map(x => x.n) : [],
    litKeyword: isFuel && liters.some(x => x.w >= 3), isFuel, text };
}
function parseOdometer(text, ref) {
  const direct = [], re = new RegExp(ODO_KM.source, 'gi'); let mm;
  while ((mm = re.exec(text))) { const v = +mm[1].replace(/\D/g, ''); if (v >= 100 && !direct.includes(v)) direct.push(v); }
  const rest = parseOdometerLoose(text, ref).filter(n => !direct.includes(n));
  return [...direct, ...rest].slice(0, 5);
}
function parseOdometerLoose(text, ref) {
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

function startOcr(ctx) {
  if (!ocrLeft()) return toast(`Você usou as ${FREE.ocr} leituras por foto deste mês. Digite os valores ou veja o Pro.`, 'Ver Pro', () => openPaywall('ocr'));
  ocrCtx = ctx; $('ocrInput').click();
}
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
    box.innerHTML = '⏳ Carregando o leitor… (na primeira vez pode demorar)';
    await OCR.load();
    const prog = p => { box.innerHTML = `⏳ Lendo a foto… ${Math.round(p * 100)}%`; };
    let text;
    if (isOdo) {
      /* 1º: procura "NNNN km" girando a foto; se não achar, cai na leitura só de números */
      text = await readOdoRotating(file, box);
      if (!text) text = await OCR.recognize(await prepImage(file, { max: 1400, min: 900 }), true, prog);
    } else {
      text = await OCR.recognize(await prepImage(file, { max: 1800, min: 1100 }), false, prog);
      /* foto do display da bomba (LCD): leitura própria quando o cupom normal não se aplica */
      if (!parseReceipt(text).isFuel) { try { const lcd = await readPumpLcd(file, box); if (lcd) text = lcd; } catch (e) { /* segue com o texto lido */ } }
    }
    ocrCount();
    if (isOdo) showOdoResult(box, ctx, text); else showReceiptResult(box, text);
    if (ocrLeft() !== Infinity) toast(`Leituras por foto restantes neste mês: ${ocrLeft()}.`);
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
  if (p.liters.length && (p.litKeyword || p.isFuel) && vehiclesOn() && $('x-cat').value !== 'abastecimento') $('x-cat').value = 'abastecimento';
  if (p.liters.length && $('x-cat').value === 'abastecimento') $('x-liters').value = fmtLit(p.liters[0]);
  /* cupom que não é de combustível (lanche, hotel…) não pode ficar como abastecimento */
  let aviso = '';
  if (!p.isFuel && $('x-cat').value === 'abastecimento') {
    const food = /caf[eé]|cappuc|p[aã]o|lanche|refri|[aá]gua|suco|salgad|bolo|queijo|pizza|hamb|almo[cç]o|restaur|bebida|sorvete|doce|chocolate/i.test(text);
    $('x-cat').value = food ? 'alimentacao' : 'outros';
    $('x-liters').value = '';
    aviso = `<div class="muted">Este cupom não parece ser de combustível; mudei a categoria para <b>${CATS[$('x-cat').value].label}</b>. Se estiver errado, troque acima.</div>`;
  }
  $('x-keepbox').classList.toggle('hidden', !ocrKeepBlob);
  recalcExpense();
  box.innerHTML = `✅ <b>Lido da foto — confira antes de salvar.</b>${aviso}
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
