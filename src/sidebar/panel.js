import { destino } from './urls.js';
const host=document.getElementById('view');
const root=host.attachShadow({mode:'open'});
let tabId=null;
const texto = (valor, maximo) => typeof valor === 'string' ? valor.slice(0,maximo) : '';
const opciones = {album:['sin-album','con-album','all'],type:['all','photo','video'],order:['desc','asc'],size:['120','170','240']};
function render(datos) {
  if (!datos?.filtros || !Array.isArray(datos.albumes) || !Array.isArray(datos.fotos)) return;
  const foco = root.activeElement?.id;
  const scroll = document.scrollingElement.scrollTop;
  root.replaceChildren();
  montarPanel(root);
  const buscar = selector => root.querySelector(selector);
  const oscuro = datos.oscuro === true;
  host.toggleAttribute('data-dark',oscuro);
  document.body.style.background = oscuro ? '#202124' : '#fff';
  buscar('#panel').hidden = false;
  buscar('#collapse').hidden = true;
  for (const [id,valores] of Object.entries(opciones)) {
    if (valores.includes(datos.filtros[id])) buscar('#'+id).value = datos.filtros[id];
  }
  for (const id of ['from','to']) buscar('#'+id).value = texto(datos.filtros[id],10);
  buscar('#hide').checked = datos.ocultar === true;
  buscar('#scan').disabled = datos.ocupado === true;
  buscar('#cancel').disabled = datos.ocupado !== true;
  if (datos.actualizar === true) buscar('#scan').textContent = 'Actualizar análisis';
  if (datos.navegacionOculta === true) buscar('#navigation').textContent = 'Mostrar menú izquierdo';
  const estado = texto(datos.estado,220);
  const estados = ['Listo para analizar · Solo lectura','Cambió la cuenta. Analizá de nuevo para ver sus resultados.','Análisis cancelado · Resultados incompletos','Google Fotos tardó demasiado · Análisis incompleto'];
  const progreso = /^(?:Leyendo álbumes|Analizando contenido de álbumes|Leyendo biblioteca|Análisis completo) · \d+\/\d+ álbumes · \d+ elementos$/;
  buscar('.status').textContent = estados.includes(estado) || progreso.test(estado) ? estado : 'No se pudo completar el análisis.';
  const albumes = buscar('#photo-albums');
  if (datos.fotoAbierta === true) {
    albumes.append(node('h3',{},'Álbumes de este elemento'));
    for (const album of datos.albumes.slice(0,1000)) {
      const href = destino(album?.url,'album');
      if (href) albumes.append(node('a',{href,target:'_blank',rel:'noopener noreferrer'},texto(album.nombre,200)));
    }
    if (!albumes.querySelector('a')) albumes.append(node('p',{},datos.sinAlbum === true ? 'Sin álbum' : 'Analizá la biblioteca para comprobar sus álbumes.'));
    if (datos.parcial === true) albumes.append(node('small',{},'Listado parcial: el análisis todavía no terminó.'));
  }
  const dialogo = buscar('dialog');
  dialogo.open = datos.galeria === true;
  if (dialogo.open) {
    const resultados = buscar('#results');
    if (Number.isSafeInteger(datos.total) && datos.total >= 0) {
      resultados.append(node('p',{class:'summary'},datos.total+' resultados · Biblioteca principal'));
      const grid = node('div',{class:'grid'});
      grid.style.setProperty('--thumbnail-size',buscar('#size').value+'px');
      for (const foto of datos.fotos.slice(0,100)) {
        const href = destino(foto?.url,'photo');
        if (!href) continue;
        const fecha = texto(foto.fecha,40);
        const imagen = node('img',{alt:'Foto del '+fecha,loading:'lazy',referrerpolicy:'no-referrer'});
        const miniatura = destino(foto.miniatura,'miniatura');
        if (miniatura) imagen.src = miniatura;
        grid.append(node('a',{href,id:'media-'+grid.children.length,target:'_blank',rel:'noopener noreferrer',title:texto(foto.titulo,500)},imagen,node('span',{},fecha)));
      }
      resultados.append(grid);
      if (!datos.total) resultados.append('No hay resultados para estos filtros.');
      if (datos.total > 100) {
        const acciones = node('div',{class:'actions'});
        for (const [id,etiqueta] of [['anterior','Anterior'],['siguiente','Siguiente']]) {
          const boton = node('button',{id},etiqueta);
          boton.disabled = datos[id] !== true;
          acciones.append(boton);
        }
        resultados.append(acciones);
      }
    } else resultados.append(node('p',{},'La galería estará disponible cuando termine el análisis completo. Los elementos pendientes no se consideran fotos sin álbum.'));
  }
  root.append(node('style',{},'.panel{position:static;width:100%;border:0;box-shadow:none;padding:16px}#collapse,dialog:not([open]){display:none}dialog[open]{position:static;margin:0;padding:16px;width:100%;height:auto;border:0}#results{height:auto;overflow:visible}.grid{grid-template-columns:repeat(auto-fill,minmax(min(var(--thumbnail-size,170px),100%),1fr))}'));
  if (foco) root.getElementById(foco)?.focus({preventScroll:true});
  document.scrollingElement.scrollTop = scroll;
}
function send(command) {
  if(tabId===null)return;
  chrome.tabs.sendMessage(tabId,{kind:'command',command}).catch(()=>{tabId=null;root.textContent='Recargá Google Fotos para conectar GalleryPRO.';});
}
root.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(button?.id) send({id:button.id,action:'click'});
});
root.addEventListener('change',event=>{
  if(event.target.id)send({id:event.target.id,action:'change',value:event.target.value,checked:event.target.checked});
});
root.addEventListener('keydown',event=>{
  const grid=event.target.closest('.grid');
  if(!grid)return;
  const links=[...grid.querySelectorAll('a')],index=links.indexOf(event.target);
  const columns=Math.max(1,Math.round(grid.clientWidth/(links[0]?.offsetWidth+16)));
  const steps={ArrowRight:1,ArrowLeft:-1,ArrowDown:columns,ArrowUp:-columns,Home:-index,End:links.length-1-index};
  if(index>=0 && event.key in steps){event.preventDefault();links[Math.max(0,Math.min(links.length-1,index+steps[event.key]))].focus();}
});
chrome.runtime.onMessage.addListener((message,sender)=>{
  if(message?.kind==='view' && sender.id===chrome.runtime.id && sender.frameId===0 && sender.url?.startsWith('https://photos.google.com/') && sender.tab?.id===tabId)render(message.snapshot);
});
async function connect() {
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab)return;
  if(tabId!==tab.id){tabId=tab.id;root.textContent='Conectando con Google Fotos…';}
  send({action:'sync'});
}
chrome.tabs.onActivated.addListener(connect);
chrome.tabs.onUpdated.addListener((id,change)=>{
  if(id!==tabId)return;
  if(change.status==='loading')root.textContent='Actualizando Google Fotos…';
  if(change.status==='complete')connect();
});
connect();
