if (!document.getElementById('gallerypro-root')) {
  const host = document.createElement('div');
  host.id = 'gallerypro-root';
  document.documentElement.append(host);
  const root = host.attachShadow({mode:'open'});
  // Crear nodos explícitos respeta Trusted Types de Google Fotos, sin políticas adicionales.
  function node(tag, attributes = {}, ...children) {
    const element = document.createElement(tag);
    for (const [key,value] of Object.entries(attributes)) element.setAttribute(key,value);
    element.append(...children);
    return element;
  }
  root.append(
    node('style',{},'__GALLERYPRO_CSS__'),
    node('section',{class:'panel','aria-label':'GalleryPRO'},
      node('header',{},node('span',{class:'brand'},'▧ Gallery',node('span',{},'PRO')),node('button',{id:'collapse','aria-label':'Minimizar panel'},'−')),
      node('div',{id:'body'},
        node('p',{class:'intro'},'Encontrá las fotos que todavía no tienen álbum.'),
        node('div',{class:'actions'},node('button',{id:'scan',class:'primary'},'Analizar biblioteca'),node('button',{id:'cancel',disabled:''},'Cancelar')),
        node('label',{class:'toggle'},node('input',{id:'hide',type:'checkbox'}),' Ocultar fotos con álbum'),
        node('p',{class:'status',role:'status','aria-live':'polite'},'Listo para analizar · Solo lectura'),
        node('button',{id:'gallery',class:'wide'},'Abrir galería de GalleryPRO'),
        node('small',{},'Sin modificar tus fotos. Volvé a analizar si cambian tus álbumes.'))),
    node('dialog',{},node('header',{},node('h2',{},'Fotos sin álbum ',node('span',{},'GalleryPRO')),node('button',{id:'close'},'Cerrar')),node('div',{id:'results'}))
  );
  const $ = selector => root.querySelector(selector);
  const hidden = new Map();
  let state = null;
  let controller = null;
  let api = null;
  let identity = accountIdentity();
  let scheduled = false;
  let collapsed = false;
  function restore() {
    for (const [element, previous] of hidden) {
      element.style.visibility = previous.visibility;
      if (previous.aria === null) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden',previous.aria);
      element.inert = previous.inert;
    }
    hidden.clear();
  }
  function filter() {
    scheduled = false;
    restore();
    if (!$('#hide').checked || !state || accountIdentity() !== identity || !/^\/(u\/\d+\/)?$/.test(location.pathname)) return;
    for (const link of document.querySelectorAll('a[href*="/photo/"]')) {
      const id = new URL(link.href).pathname.split('/photo/')[1];
      const item = state.items.get(id);
      const member = item ? !item.video && belongsToAlbum(item,state.members) : false;
      if (!member) continue;
      // Google virtualiza la cuadrícula: conservar dimensiones mantiene el desplazamiento.
      const parent = link.parentElement;
      const element = parent && parent.querySelectorAll('a[href*="/photo/"]').length === 1 && parent.querySelector('[role="checkbox"]') ? parent : link;
      hidden.set(element,{visibility:element.style.visibility,aria:element.getAttribute('aria-hidden'),inert:element.inert});
      element.style.visibility = 'hidden';
      element.setAttribute('aria-hidden','true');
      element.inert = true;
    }
  }
  function schedule() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(filter); }
  }
  function status(message) { $('.status').textContent = message; }
  function update(next) {
    state = next;
    status(next.phase + ' · ' + next.processedAlbums + '/' + next.albums + ' álbumes · ' + next.items.size + ' elementos');
    schedule();
    if ($('dialog').open && next.complete) renderGallery($('#results'),state,api.accountPath);
  }
  function reset() {
    controller?.abort();
    controller = null;
    state = null;
    api = null;
    restore();
    $('#results').replaceChildren();
    $('dialog').close();
    $('#scan').disabled = false;
    $('#cancel').disabled = true;
    status('Cambió la cuenta. Analizá de nuevo para ver sus resultados.');
  }
  $('#scan').onclick = async () => {
    if (controller) return;
    restore();
    state = null;
    const active = new AbortController();
    controller = active;
    $('#scan').disabled = true;
    $('#cancel').disabled = false;
    $('#results').replaceChildren();
    try {
      api = createGoogleApi();
      identity = api.identity;
      await analyze(api,active.signal, next => { if (controller === active) update(next); });
    } catch (error) {
      if (controller === active) {
        if (state) state.complete = false;
        status(active.signal.aborted ? 'Análisis cancelado · Resultados incompletos' : (error.name === 'TimeoutError' ? 'Google Fotos tardó demasiado · Análisis incompleto' : error.message));
        if ($('dialog').open) renderGallery($('#results'),state,api?.accountPath || '');
      }
    } finally {
      if (controller === active) {
        controller = null;
        $('#scan').disabled = false;
        $('#scan').textContent = 'Actualizar análisis';
        $('#cancel').disabled = true;
      }
    }
  };
  $('#cancel').onclick = () => controller?.abort();
  $('#hide').onchange = () => {
    window.dispatchEvent(new CustomEvent('gallerypro:preferences',{detail:$('#hide').checked}));
    schedule();
  };
  $('#gallery').onclick = () => {
    renderGallery($('#results'),state,api?.accountPath || '');
    $('dialog').showModal();
  };
  $('#close').onclick = () => $('dialog').close();
  $('#collapse').onclick = () => {
    collapsed = !collapsed;
    $('#body').hidden = collapsed;
    $('#collapse').textContent = collapsed ? '+' : '−';
    $('#collapse').setAttribute('aria-label',collapsed ? 'Expandir panel' : 'Minimizar panel');
  };
  window.addEventListener('gallerypro:settings', event => { if (typeof event.detail === 'boolean') { $('#hide').checked = event.detail; schedule(); } });
  window.dispatchEvent(new CustomEvent('gallerypro:preferences',{detail:'read'}));
  // No observar los atributos que modifica el filtro, para evitar ciclos.
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['href']});
  let previousPath = location.pathname;
  setInterval(() => {
    const current = accountIdentity();
    if (current !== identity) { reset(); identity = current; }
    if (previousPath !== location.pathname) { previousPath = location.pathname; schedule(); }
  },500);
}
