export function renderGallery(container, state, accountPath, offset = 0) {
  container.replaceChildren();
  if (!state?.complete) {
    const message = document.createElement('p');
    message.textContent = 'La galería estará disponible cuando termine el análisis completo. Los elementos pendientes no se consideran fotos sin álbum.';
    container.append(message);
    return;
  }
  const photos = [...state.items.values()].filter(item => !item.video && classify(item, state.members, true) === 'sin-album');
  const count = document.createElement('p');
  count.className = 'summary';
  count.textContent = photos.length + ' fotos sin álbum · Biblioteca principal';
  container.append(count);
  const grid = document.createElement('div');
  grid.className = 'grid';
  for (const item of photos.slice(offset, offset + 100)) {
    const link = document.createElement('a');
    link.href = 'https://photos.google.com' + accountPath + '/photo/' + encodeURIComponent(item.id);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const date = Number.isFinite(item.timestamp) ? new Date(item.timestamp).toLocaleDateString('es') : 'Foto';
    link.setAttribute('aria-label', 'Abrir foto · ' + date);
    const image = document.createElement('img');
    image.alt = 'Foto del ' + date;
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    if (item.thumb) image.src = item.thumb + '=w400-h300';
    const caption = document.createElement('span');
    caption.textContent = date;
    link.append(image, caption);
    grid.append(link);
  }
  container.append(grid);
  if (!photos.length) container.append(document.createTextNode('No se encontraron fotos sin álbum.'));
  const navigation = document.createElement('div');
  navigation.className = 'actions';
  for (const [label, next, enabled] of [['Anterior',offset-100,offset>0],['Siguiente',offset+100,offset+100<photos.length]]) {
    const button = document.createElement('button');
    button.textContent = label;
    button.disabled = !enabled;
    button.onclick = () => { renderGallery(container,state,accountPath,next); container.scrollTop = 0; };
    navigation.append(button);
  }
  if (photos.length > 100) container.append(navigation);
}
