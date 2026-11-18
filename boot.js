'use strict';
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
