// Protocolo de lectura contrastado con Google Photos Toolkit (MIT).
// Ver THIRD_PARTY_NOTICES.md. Nunca se aceptan identificadores RPC externos.
export function decodeEnvelope(text, method) {
  for (const line of text.split('\n')) {
    if (!line.startsWith('[')) continue;
    let rows;
    try { rows = JSON.parse(line); } catch { continue; }
    if (!Array.isArray(rows)) continue;
    const response = rows.find(row => row?.[0] === 'wrb.fr' && row[1] === method);
    if (typeof response?.[2] === 'string') return JSON.parse(response[2]);
  }
  throw new Error('Google Fotos devolvió un formato desconocido. Análisis incompleto.');
}

export function parsePage(data, kind) {
  const album = kind === 'album';
  if (!Array.isArray(data) || data.length < (album ? 4 : 1)) throw new Error('Respuesta incompleta de Google Fotos.');
  const rows = data[album ? 1 : 0];
  const next = data[album ? 2 : 1];
  if (rows !== null && !Array.isArray(rows)) throw new Error('No se pudo leer la lista de Google Fotos.');
  if (next != null && typeof next !== 'string') throw new Error('Cursor de Google Fotos no reconocido.');
  if (album && !Array.isArray(data[3])) throw new Error('No se pudo verificar el acceso al álbum.');
  const items = (rows || []).map(row => {
    if (!Array.isArray(row) || typeof row[0] !== 'string' || !row[0]) throw new Error('Identificador no reconocido.');
    if (kind === 'albums') {
      const metadata = row.at(-1)?.['72930366'];
      if (!Array.isArray(metadata)) throw new Error('Metadatos de álbum no reconocidos.');
      return { id: row[0], title: typeof metadata[1] === 'string' ? metadata[1] : 'Álbum', auth: metadata[5] || null };
    }
    if (typeof row[3] !== 'string' || !row[3]) throw new Error('No se pudo comparar una foto con sus álbumes.');
    const thumb = row[1]?.[0];
    return { id: row[0], key: row[3], timestamp: Number(row[2]), thumb: safeThumbnail(thumb), video: row.at(-1)?.['76647426'] != null };
  });
  // La última página de algunos álbumes utiliza cadena vacía en lugar de null.
  return { items, next: next || null };
}

export function safeThumbnail(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && (url.hostname === 'photos.fife.usercontent.google.com' || url.hostname === 'googleusercontent.com' || url.hostname.endsWith('.googleusercontent.com'))) return url.href;
  } catch { /* Una miniatura inválida nunca se transforma en contenido HTML. */ }
  return '';
}

export function accountIdentity() {
  const data = window.WIZ_global_data;
  if (!data || typeof data.oPEP7c !== 'string' || !data.oPEP7c || typeof data.eptZe !== 'string') return null;
  return data.oPEP7c + '|' + data.eptZe;
}

export function createGoogleApi() {
  const identity = accountIdentity();
  if (!identity) throw new Error('Abrí Google Fotos con una cuenta iniciada y recargá la página.');
  const data = window.WIZ_global_data;
  const base = new URL(data.eptZe, location.origin);
  if (base.origin !== 'https://photos.google.com') throw new Error('Origen de Google Fotos no reconocido.');
  const accountPath = location.pathname.match(/^\/u\/\d+/)?.[0] || '';
  let lastRequest = 0;
  async function rpc(method, body, signal) {
    if (accountIdentity() !== identity) throw new Error('Cambió la cuenta. Volvé a analizar.');
    const wait = Math.max(0, 150 - (Date.now() - lastRequest));
    await new Promise(resolve => setTimeout(resolve, wait));
    signal.throwIfAborted();
    lastRequest = Date.now();
    const params = new URLSearchParams({rpcids: method, 'source-path': location.pathname, 'f.sid': data.FdrFJe, bl: data.cfb2h, rt: 'c'});
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(30000)]);
    const response = await fetch(new URL('data/batchexecute?' + params, base), {
      method: 'POST', credentials: 'include', signal: requestSignal,
      headers: {'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'},
      body: new URLSearchParams({'f.req': JSON.stringify([[[method, JSON.stringify(body), null, 'generic']]]), at: data.SNlM0e})
    });
    if (!response.ok) throw new Error('Google Fotos respondió HTTP ' + response.status + '. Volvé a intentar más tarde.');
    const result = decodeEnvelope(await response.text(), method);
    if (accountIdentity() !== identity) throw new Error('Cambió la cuenta. Volvé a analizar.');
    return result;
  }
  return {
    identity, accountPath,
    albums: async (cursor, signal) => parsePage(await rpc('Z5xsfc', [cursor,null,null,null,1,null,null,100,[2],5],signal),'albums'),
    album: async (album,cursor,signal) => parsePage(await rpc('snAcKc',[album.id,cursor,null,album.auth],signal),'album'),
    library: async (cursor,signal) => parsePage(await rpc('lcxiM',[cursor,null,500,null,1,1],signal),'library')
  };
}
