if (!document.getElementById('gallerypro-root')) {
  const host = document.createElement('div');
  host.id = 'gallerypro-root';
  document.documentElement.append(host);
  const root = host.attachShadow({mode:'open'});
  montarPanel(root);
  const $ = selector => root.querySelector(selector);
  $('dialog').style.display='none';
  const hidden = new Map();
  let state = null;
  let controller = null;
  let api = null;
  let identity = accountIdentity();
  let scheduled = false;
  let panelOpen = false;
  const launcherHost = node('span',{id:'gallerypro-launcher'});
  const launcherRoot = launcherHost.attachShadow({mode:'open'});
  const launcher = node('button',{
    type:'button',title:'GalleryPRO','aria-label':'Abrir panel de GalleryPRO','aria-expanded':'false'
  },'▧');
  launcherRoot.append(node('style',{},`
    :host { display: inline-flex; align-items: center; margin-right: 4px; }
    button { width: 40px; height: 40px; border: 0; border-radius: 50%; background: transparent; color: #8b7ce8; font: 28px system-ui; cursor: pointer; }
    button:hover,button[aria-expanded="true"] { background: #6354cf22; }
    button:focus-visible { outline: 2px solid #8b7ce8; outline-offset: 2px; }
  `),launcher);
  const layoutStyle = node('style',{id:'gallerypro-layout'},`
    html.gallerypro-sidebar-open #yDmH0d { position: relative !important; width: calc(100% - var(--gallerypro-sidebar-width)) !important; }
  `);
  document.head.append(layoutStyle);
  function sidebarWidth() { return Math.min(360, Math.floor(window.innerWidth * .45)); }
  function resizePanel() {
    const width = sidebarWidth() + 'px';
    host.style.setProperty('--gallerypro-sidebar-width',width);
    document.documentElement.style.setProperty('--gallerypro-sidebar-width',width);
  }
  function setPanelOpen(open) {
    panelOpen = open;
    $('#panel').hidden = !open;
    launcher.setAttribute('aria-expanded',String(open));
    launcher.setAttribute('aria-label',open ? 'Cerrar panel de GalleryPRO' : 'Abrir panel de GalleryPRO');
    // El panel nativo de Chrome reduce el viewport real de Google Fotos.
    document.documentElement.classList.remove('gallerypro-sidebar-open');
    resizePanel();
    // Google Fotos recalcula su cuadrícula cuando cambia el espacio disponible.
    window.dispatchEvent(new Event('resize'));
    if (open) $('#collapse').focus(); else launcher.focus();
  }
  function attachLauncher() {
    const create = document.querySelector('[aria-label="Crear y agregar fotos"], [aria-label="Crear y añadir fotos"], [aria-label="Create and add photos"]');
    if (!create) return;
    let anchor = create;
    while (anchor.parentElement && getComputedStyle(anchor.parentElement).display !== 'flex') anchor = anchor.parentElement;
    if (anchor.parentElement && (launcherHost.parentElement !== anchor.parentElement || launcherHost.nextSibling !== anchor)) {
      anchor.before(launcherHost);
    }
  }
  launcher.onclick = () => window.dispatchEvent(new CustomEvent('gallerypro:open-panel'));
  $('#panel').addEventListener('keydown',event => {
    if (event.key === 'Escape') { setPanelOpen(false); event.stopPropagation(); }
  });
  resizePanel();
  attachLauncher();
  window.addEventListener('resize',resizePanel);
  function filters() {
    return Object.fromEntries(['album','type','from','to','order','size'].map(id=>[id,$('#'+id).value]));
  }
  for (const id of ['album','type','from','to','order','size']) $('#'+id).onchange = () => {
    schedule();
    if ($('dialog').open) renderGallery($('#results'),state,api?.accountPath || '',0,filters());
  };
  let navigationHidden = false;
  const navStyle = node('style',{},`
    [data-gallerypro-nav-hidden] { display: none !important; }
    [data-gallerypro-main-expanded] { left: 0 !important; width: 100% !important; }
  `);
  document.head.append(navStyle);
  function navigationElements() {
    const main = document.querySelector('[role="main"]');
    const header = document.querySelector('[role="menubar"]');
    const nav = navigationContainer(document.querySelector('[role="tab"]'),main,header);
    return {main,header,nav};
  }
  function navigationLayout() {
    const {main,nav} = navigationElements();
    // Retirar marcas anteriores incluso si Google reemplazó el menú al navegar.
    for (const element of document.querySelectorAll('[data-gallerypro-nav-hidden],[data-gallerypro-main-expanded]')) {
      element.removeAttribute('data-gallerypro-nav-hidden');
      element.removeAttribute('data-gallerypro-main-expanded');
    }
    if (!nav || !main?.parentElement || main.parentElement.contains(nav)) {
      navigationHidden = false;
      return;
    }
    nav.toggleAttribute('data-gallerypro-nav-hidden',navigationHidden);
    main.parentElement.toggleAttribute('data-gallerypro-main-expanded',navigationHidden);
    $('#navigation').textContent = navigationHidden ? 'Mostrar menú izquierdo' : 'Ocultar menú izquierdo';
    window.dispatchEvent(new Event('resize'));
  }
  const navToggle = node('button',{id:'nav-toggle',class:'nav-toggle','aria-label':'Ocultar menú izquierdo',title:'Ocultar menú izquierdo','aria-expanded':'true'},'‹');
  root.append(navToggle);
  function positionNavigationToggle() {
    const {nav,header} = navigationElements();
    const unavailable = !nav || !header;
    if (navToggle.hidden !== unavailable) navToggle.hidden = unavailable;
    if (unavailable) return;
    const bounds = nav.getBoundingClientRect();
    const left = navigationHidden ? 8 : Math.max(8,bounds.right-32);
    const top = header.getBoundingClientRect().bottom + 4;
    if (navToggle.style.left !== left+'px') navToggle.style.left = left+'px';
    if (navToggle.style.top !== top+'px') navToggle.style.top = top+'px';
  }
  function toggleNavigation() {
    navigationHidden=!navigationHidden;
    navigationLayout();
    const label = navigationHidden?'Mostrar menú izquierdo':'Ocultar menú izquierdo';
    navToggle.textContent=navigationHidden?'›':'‹';
    navToggle.setAttribute('aria-label',label);
    navToggle.setAttribute('title',label);
    navToggle.setAttribute('aria-expanded',String(!navigationHidden));
    positionNavigationToggle();
  }
  positionNavigationToggle();
  navToggle.onclick=toggleNavigation;
  $('#navigation').onclick=toggleNavigation;
  function updatePhotoAlbums() {
    const id = location.pathname.split('/photo/')[1];
    const box = $('#photo-albums');
    box.replaceChildren();
    if (!id) return;
    box.append(node('h3',{},'Álbumes de este elemento'));
    const item = state?.items.get(id) || state?.albumItems.get(id) || {id};
    const albums = albumsFor(item,state);
    for (const album of albums) box.append(node('a',{href:'https://photos.google.com'+(api?.accountPath || '')+'/album/'+encodeURIComponent(album.id),target:'_blank',rel:'noopener noreferrer'},album.title || 'Álbum'));
    if (!albums.length) box.append(node('p',{},state?.complete && (state.items.has(id) || state.albumItems.has(id)) ? 'Sin álbum' : 'Analizá la biblioteca para comprobar sus álbumes.'));
    if (!state?.complete && albums.length) box.append(node('small',{},'Listado parcial: el análisis todavía no terminó.'));
  }
  function syncTheme() {
    const bar = document.querySelector('[role="menubar"]');
    const rgb = getComputedStyle(bar || document.body).backgroundColor.match(/\d+/g);
    const dark = rgb && Number(rgb[3] ?? 1) !== 0 ? (Number(rgb[0])+Number(rgb[1])+Number(rgb[2])) < 384 : matchMedia('(prefers-color-scheme: dark)').matches;
    if (host.hasAttribute('data-dark') !== Boolean(dark)) { host.toggleAttribute('data-dark',dark); publish(); }
  }
  function datosPanel() {
    const resultados = $('#results');
    const albumes = $('#photo-albums');
    return {
      filtros: filters(), oscuro: host.hasAttribute('data-dark'), ocultar: $('#hide').checked,
      ocupado: $('#scan').disabled, actualizar: $('#scan').textContent === 'Actualizar análisis',
      navegacionOculta: navigationHidden, estado: $('.status').textContent,
      fotoAbierta: Boolean(albumes.querySelector('h3')), sinAlbum: albumes.querySelector('p')?.textContent === 'Sin álbum',
      parcial: Boolean(albumes.querySelector('small')),
      albumes: [...albumes.querySelectorAll('a')].map(a => ({url:a.href, nombre:a.textContent})),
      galeria: $('dialog').open, total: Number.parseInt(resultados.querySelector('.summary')?.textContent,10),
      fotos: [...resultados.querySelectorAll('.grid a')].map(a => ({
        url:a.href, miniatura:a.querySelector('img')?.getAttribute('src'), titulo:a.title, fecha:a.querySelector('span')?.textContent
      })),
      anterior: $('#anterior')?.disabled === false, siguiente: $('#siguiente')?.disabled === false
    };
  }
  let publishTimer;
  function publish() {
    clearTimeout(publishTimer);
    publishTimer = setTimeout(()=>window.dispatchEvent(new CustomEvent('gallerypro:view',{detail:datosPanel()})),60);
  }
  new MutationObserver(records => { if (records.some(record=>record.target!==navToggle)) publish(); }).observe(root,{subtree:true,childList:true,characterData:true,attributes:true});
  window.addEventListener('gallerypro:command',event=>{
    const {id,action,value,checked} = event.detail || {};
    if (action === 'sync') { syncTheme(); publish(); return; }
    const element = root.getElementById(id);
    if (!element) return;
    if (action === 'click') element.click();
    if (action === 'change' && ['INPUT','SELECT'].includes(element.tagName)) {
      element.value = String(value ?? ''); element.checked = Boolean(checked);
      element.dispatchEvent(new Event('change',{bubbles:true}));
    }
    publish();
  });
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
      // Ante información incompleta o desconocida, conservar la miniatura.
      if (!item || !state.complete || matchesFilters(item,state,filters())) continue;
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
    updatePhotoAlbums();
    if ($('dialog').open && next.complete) renderGallery($('#results'),state,api.accountPath,0,filters());
  }
  function reset() {
    controller?.abort();
    controller = null;
    state = null;
    api = null;
    restore();
    $('#results').replaceChildren();
    $('#photo-albums').replaceChildren();
    $('dialog').removeAttribute('open');
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
        if ($('dialog').open) renderGallery($('#results'),state,api?.accountPath || '',0,filters());
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
    renderGallery($('#results'),state,api?.accountPath || '',0,filters());
    $('dialog').setAttribute('open','');
  };
  $('#close').onclick = () => $('dialog').removeAttribute('open');
  $('#collapse').onclick = () => setPanelOpen(false);
  window.addEventListener('gallerypro:settings', event => { if (typeof event.detail === 'boolean') { $('#hide').checked = event.detail; schedule(); } });
  window.dispatchEvent(new CustomEvent('gallerypro:preferences',{detail:'read'}));
  // No observar los atributos que modifica el filtro, para evitar ciclos.
  new MutationObserver(() => { attachLauncher(); schedule(); }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['href']});
  let previousPath = location.pathname;
  setInterval(() => {
    const current = accountIdentity();
    if (current !== identity) { reset(); identity = current; }
    syncTheme();
    positionNavigationToggle();
    if (previousPath !== location.pathname) { previousPath = location.pathname; if (navigationHidden) navigationLayout(); schedule(); updatePhotoAlbums(); }
  },500);
}
