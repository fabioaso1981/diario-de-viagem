'use strict';
/* ===== Service worker ===== */
/* O aviso de nova versão fica na tela até a pessoa tocar (antes sumia em 8 s e passava despercebido) */
function offerUpdate(w) { toast('Nova versão do app disponível.', 'Atualizar', () => w.postMessage('SKIP_WAITING'), true); }
async function checkForUpdate(manual) {
  if (!('serviceWorker' in navigator)) { if (manual) toast('Este navegador não tem atualização automática.'); return; }
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) { if (manual) toast('O app ainda não foi instalado para uso offline. Abra uma vez com internet.'); return; }
    if (manual) toast('Verificando…');
    await reg.update();
    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
    else if (reg.installing) { if (manual) toast('Baixando a nova versão…'); }
    else if (manual) toast('Você já está na versão mais recente.');
  } catch (e) { if (manual) toast('Sem conexão para verificar agora.'); }
}
function setupSW() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; location.reload(); });
  navigator.serviceWorker.register('sw.js').then(reg => {
    const watch = w => w && w.addEventListener('statechange', () => {
      if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(w);
    });
    watch(reg.installing); reg.addEventListener('updatefound', () => watch(reg.installing));
    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
  }).catch(() => { /* sem offline */ });
  /* o Android mantém o app aberto em segundo plano: confere também ao voltar para ele e a cada hora */
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate(false); });
  setInterval(() => checkForUpdate(false), 3600e3);
}

/* ===== Inicialização (carrega por último, depois de todos os módulos) ===== */
(async function init() {
  await loadState();
  applyTheme();
  renderHeader(); renderView();
  setupSW();
  if (!state.setupDone) openSetup();
  else setTimeout(() => { const id = currentDayId(); const el = id && $('day-' + id); if (el && hasData()) el.scrollIntoView({ block: 'start' }); }, 50);
  window.addEventListener('resize', () => document.documentElement.style.setProperty('--hdr', $('hdr').offsetHeight + 'px'));
})();
