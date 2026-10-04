export function belongsToAlbum(item, members) {
  return members.has(item.id) || members.has(item.key);
}

export function classify(item, members, complete) {
  if (belongsToAlbum(item, members)) return 'con-album';
  return complete ? 'sin-album' : 'pendiente';
}

export async function readPages(fetchPage, accept, signal) {
  let cursor = null;
  const visited = new Set();
  do {
    signal.throwIfAborted();
    const page = await fetchPage(cursor);
    signal.throwIfAborted();
    if (!page || !Array.isArray(page.items)) throw new Error('La respuesta de Google Fotos cambió. Análisis incompleto.');
    accept(page.items);
    cursor = page.next;
    if (cursor != null && (typeof cursor !== 'string' || !cursor || visited.has(cursor))) {
      throw new Error('La paginación no avanza. Análisis incompleto.');
    }
    if (cursor != null) visited.add(cursor);
  } while (cursor != null);
}

export async function analyze(api, signal, update) {
  const state = { items: new Map(), members: new Set(), membership: new Map(), albumItems: new Map(), albums: 0, processedAlbums: 0, complete: false, phase: 'Leyendo álbumes' };
  const albums = new Map();
  update(state);
  await readPages(c => api.albums(c, signal), rows => {
    rows.forEach(row => albums.set(row.id, row));
    state.albums = albums.size;
    update(state);
  }, signal);
  for (const album of albums.values()) {
    state.phase = 'Analizando contenido de álbumes';
    await readPages(c => api.album(album, c, signal), rows => {
      for (const item of rows) {
        state.albumItems.set(item.id,item);
        for (const key of new Set([item.id,item.key].filter(Boolean))) {
          if (!state.membership.has(key)) state.membership.set(key,new Map());
          state.membership.get(key).set(album.id,album);
        }
        state.members.add(item.id);
        if (item.key) state.members.add(item.key);
      }
      update(state);
    }, signal);
    state.processedAlbums++;
    update(state);
  }
  state.phase = 'Leyendo biblioteca';
  await readPages(c => api.library(c, signal), rows => {
    rows.forEach(row => state.items.set(row.id, row));
    update(state);
  }, signal);
  signal.throwIfAborted();
  state.complete = true;
  state.phase = 'Análisis completo';
  update(state);
  return state;
}

export function albumsFor(item, state) {
  const albums = new Map();
  for (const key of [item?.id,item?.key]) {
    for (const [id,album] of state?.membership?.get(key) || []) albums.set(id,album);
  }
  return [...albums.values()];
}

export function matchesFilters(item, state, filters) {
  const classification = classify(item,state.members,state.complete);
  if (filters.album === 'sin-album' && classification !== 'sin-album') return false;
  if (filters.album === 'con-album' && classification !== 'con-album') return false;
  if (filters.type === 'photo' && item.video) return false;
  if (filters.type === 'video' && !item.video) return false;
  if (filters.from || filters.to) {
    if (!Number.isFinite(item.timestamp)) return false;
    if (filters.from && item.timestamp < new Date(filters.from + 'T00:00:00').getTime()) return false;
    if (filters.to && item.timestamp > new Date(filters.to + 'T23:59:59.999').getTime()) return false;
  }
  return true;
}
