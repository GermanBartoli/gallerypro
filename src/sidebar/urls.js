export function destino(valor, tipo) {
  if (typeof valor !== 'string' || valor.length > 8192) return;
  try {
    const url = new URL(valor);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return;
    if (tipo === 'miniatura') {
      if (url.hostname === 'googleusercontent.com' || url.hostname.endsWith('.googleusercontent.com') || url.hostname === 'photos.fife.usercontent.google.com') return url.href;
      return;
    }
    if (url.hostname !== 'photos.google.com' || url.search || url.hash) return;
    const ruta = /^\/(?:u\/\d+\/)?(photo|album)\/[\w-]+$/.exec(url.pathname);
    if (ruta && ruta[1] === tipo) return url.href;
  } catch {
    return;
  }
}
