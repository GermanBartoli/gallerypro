export function renderGallery(container, state, accountPath, offset = 0, filters = {album:'sin-album',type:'all',order:'desc',size:'170'}) {
  container.replaceChildren();
  if (!state?.complete) {
    const message = document.createElement('p');
    message.textContent = 'La galería estará disponible cuando termine el análisis completo. Los elementos pendientes no se consideran fotos sin álbum.';
    container.append(message);
    return;
  }
  const photos = [...state.items.values()].filter(item => matchesFilters(item,state,filters)).sort((a,b) => (filters.order === 'asc' ? 1 : -1) * ((a.timestamp || 0)-(b.timestamp || 0)));
  const count = document.createElement('p');
  count.className = 'summary';
  count.textContent = photos.length + ' resultados · Biblioteca principal';
  container.append(count);
  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.style.setProperty('--thumbnail-size',filters.size + 'px');
  for (const item of photos.slice(offset, offset + 100)) {
    const link = document.createElement('a');
    link.href = 'https://photos.google.com' + accountPath + '/photo/' + encodeURIComponent(item.id);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const date = Number.isFinite(item.timestamp) ? new Date(item.timestamp).toLocaleDateString('es') : 'Foto';
    link.setAttribute('aria-label', 'Abrir ' + (item.video ? 'video' : 'foto') + ' · ' + date);
    link.id = 'media-' + (offset + grid.children.length);
    link.title = albumsFor(item,state).map(a=>a.title || 'Álbum').join(', ') || 'Sin álbum';
    const image = document.createElement('img');
    image.alt = 'Foto del ' + date;
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    if (item.thumb) image.src = item.thumb + '=w400-h300';
    const caption = document.createElement('span');
    caption.textContent = (item.video ? '▶ ' : '') + date;
    link.append(image, caption);
    grid.append(link);
  }
  grid.onkeydown = event => {
    const links = [...grid.querySelectorAll('a')];
    const index = links.indexOf(event.target);
    const columns = Math.max(1,Math.round(grid.clientWidth / (links[0]?.offsetWidth + 16)));
    const steps = {ArrowRight:1,ArrowLeft:-1,ArrowDown:columns,ArrowUp:-columns,Home:-index,End:links.length-1-index};
    if (index >= 0 && event.key in steps) {
      event.preventDefault();
      links[Math.max(0,Math.min(links.length-1,index+steps[event.key]))].focus();
    }
  };
  container.append(grid);
  if (!photos.length) container.append(document.createTextNode('No hay resultados para estos filtros.'));
  const navigation = document.createElement('div');
  navigation.className = 'actions';
  for (const [label, next, enabled] of [['Anterior',offset-100,offset>0],['Siguiente',offset+100,offset+100<photos.length]]) {
    const button = document.createElement('button');
    button.textContent = label;
    button.disabled = !enabled;
    button.onclick = () => { renderGallery(container,state,accountPath,next,filters); container.scrollTop = 0; };
    navigation.append(button);
  }
  if (photos.length > 100) container.append(navigation);
}
