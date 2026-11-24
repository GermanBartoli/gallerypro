// Crear nodos explícitos respeta Trusted Types de Google Fotos, sin políticas adicionales.
function node(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key,value] of Object.entries(attributes)) element.setAttribute(key,value);
  element.append(...children);
  return element;
}
function montarPanel(root) {
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
}
