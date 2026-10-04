// Solo se guardan preferencias booleanas; nunca fotos, cuentas ni resultados.
window.addEventListener('gallerypro:preferences', event => {
  if (event.detail === 'read') {
    chrome.storage.local.get({ galleryproHide: false }).then(value => {
      window.dispatchEvent(new CustomEvent('gallerypro:settings', { detail: value.galleryproHide === true }));
    });
  } else if (typeof event.detail === 'boolean') {
    chrome.storage.local.set({ galleryproHide: event.detail });
  }
});
