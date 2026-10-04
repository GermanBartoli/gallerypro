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
    node('section',{class:'panel',id:'panel','aria-label':'GalleryPRO',hidden:''},
      node('header',{},node('span',{class:'brand'},'▧ Gallery',node('span',{},'PRO')),node('button',{id:'collapse','aria-label':'Cerrar panel de GalleryPRO'},'×')),
      node('div',{id:'body'},
        node('p',{class:'intro'},'Encontrá las fotos que todavía no tienen álbum.'),
        node('div',{class:'actions'},node('button',{id:'scan',class:'primary'},'Analizar biblioteca'),node('button',{id:'cancel',disabled:''},'Cancelar')),
        node('label',{class:'toggle'},node('input',{id:'hide',type:'checkbox'}),' Aplicar filtros en Google Fotos'),
        node('label',{},'Álbum',node('select',{id:'album'},node('option',{value:'sin-album'},'Sin álbum'),node('option',{value:'con-album'},'Con álbum'),node('option',{value:'all'},'Todos'))),
        node('label',{},'Tipo',node('select',{id:'type'},node('option',{value:'all'},'Fotos y videos'),node('option',{value:'photo'},'Solo fotos'),node('option',{value:'video'},'Solo videos'))),
        node('div',{class:'dates'},node('label',{},'Desde',node('input',{id:'from',type:'date'})),node('label',{},'Hasta',node('input',{id:'to',type:'date'}))),
        node('label',{},'Orden de galería',node('select',{id:'order'},node('option',{value:'desc'},'Más recientes primero'),node('option',{value:'asc'},'Más antiguas primero'))),
        node('label',{},'Miniaturas',node('select',{id:'size'},node('option',{value:'120'},'Pequeñas'),node('option',{value:'170',selected:''},'Medianas'),node('option',{value:'240'},'Grandes'))),
        node('button',{id:'navigation',class:'wide'},'Ocultar menú izquierdo'),
        node('section',{id:'photo-albums','aria-live':'polite'}),
        node('p',{class:'status',role:'status','aria-live':'polite'},'Listo para analizar · Solo lectura'),
        node('button',{id:'gallery',class:'wide'},'Abrir galería de GalleryPRO'),
        node('small',{},'Sin modificar tus fotos. Volvé a analizar si cambian tus álbumes.'))),
    node('dialog',{},node('header',{},node('h2',{},'Galería ',node('span',{},'GalleryPRO')),node('button',{id:'close'},'Cerrar')),node('div',{id:'results'}))
  );
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
  // La vista nativa recibe únicamente el árbol de la interfaz de GalleryPRO.
  const allowedAttributes = new Set(['id','class','type','href','src','target','rel','title','role','aria-label','aria-live','aria-expanded','disabled','hidden','open','min','max','step']);
  function snapshotNode(element) {
    if (element.nodeType === 3) return element.textContent;
    if (element.nodeType !== 1) return null;
    const attrs = Object.fromEntries([...element.attributes].filter(a=>allowedAttributes.has(a.name)).map(a=>[a.name,a.value]));
    if (element.className === 'grid') attrs['data-size'] = $('#size').value;
    return {tag:element.tagName.toLowerCase(),attrs,value:element.value,checked:element.checked,children:[...element.childNodes].map(snapshotNode).filter(v=>v!==null)};
  }
  let publishTimer;
  function publish() {
    clearTimeout(publishTimer);
    publishTimer = setTimeout(()=>window.dispatchEvent(new CustomEvent('gallerypro:view',{detail:{dark:host.hasAttribute('data-dark'),tree:[...root.childNodes].filter(n=>n.id!=='nav-toggle').map(snapshotNode)}})),60);
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
  let actionIndex=0;
  function identifyButtons() { for(const button of root.querySelectorAll('button')) if(!button.id) button.id='action-'+(++actionIndex); }
  new MutationObserver(identifyButtons).observe(root,{subtree:true,childList:true});
  identifyButtons();
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
