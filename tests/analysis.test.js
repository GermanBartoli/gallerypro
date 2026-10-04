import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, classify, readPages, albumsFor, matchesFilters } from '../src/core/analysis.js';
import { createGoogleApi, decodeEnvelope, parsePage, safeThumbnail } from '../src/integration/google-photos.js';

const item = (id,key=id) => ({id,key,thumb:'',video:false});
const page = (items,next=null) => ({items,next});
const signal = () => new AbortController().signal;

test('clasificación conservadora y correspondencia entre álbum y biblioteca', () => {
  const members = new Set(['clave-compartida']);
  assert.equal(classify(item('biblioteca','clave-compartida'),members,false),'con-album');
  assert.equal(classify(item('nueva'),members,false),'pendiente');
  assert.equal(classify(item('nueva'),members,true),'sin-album');
});

test('recorre varias páginas y une álbumes propios y compartidos sin duplicar fotos', async () => {
  const api = {
    albums: async c => c === null ? page([{id:'propio'}],'pagina-2') : page([{id:'compartido'},{id:'propio'}]),
    album: async (a,c) => a.id === 'propio' ? (c === null ? page([item('album-a','a')],'otra') : page([item('album-b','b')])) : page([item('album-c','c')]),
    library: async c => c === null ? page([item('a'),item('b')],'siguiente') : page([item('b'),item('c'),item('d')])
  };
  const states=[];
  const result=await analyze(api,signal(), s=>states.push(s.complete));
  assert.equal(result.albums,2);
  assert.equal(result.processedAlbums,2);
  assert.equal(result.items.size,4);
  assert.equal(result.complete,true);
  assert.deepEqual([...result.items.values()].filter(i=>classify(i,result.members,true)==='sin-album').map(i=>i.id),['d']);
  assert.ok(states.slice(0,-1).every(v=>v===false));
});

test('un álbum inaccesible nunca produce resultado completo', async () => {
  let last;
  await assert.rejects(analyze({albums:async()=>page([{id:'a'}]),album:async()=>{throw Error('HTTP 403');}},signal(),s=>{last=s;}),/403/);
  assert.equal(last.complete,false);
});

test('un error a mitad de biblioteca conserva elementos como pendientes', async () => {
  let last;
  await assert.rejects(analyze({albums:async()=>page([]),library:async c=>{if(c)throw Error('fallo');return page([item('a')],'otra');}},signal(),s=>{last=s;}),/fallo/);
  assert.equal(classify(last.items.get('a'),last.members,last.complete),'pendiente');
});

test('cancelar detiene la paginación',async()=>{
  const controller = new AbortController();
  let requests=0;
  await assert.rejects(readPages(async()=>{requests++;return page([item('a')],'otra');},()=>controller.abort(),controller.signal),{name:'AbortError'});
  assert.equal(requests,1);
});

test('detecta cursores repetidos y páginas inválidas',async()=>{
  await assert.rejects(readPages(async()=>page([],'igual'),()=>{},signal()),/no avanza/);
  await assert.rejects(readPages(async()=>({}),()=>{},signal()),/incompleto/);
});

test('biblioteca y álbumes vacíos completan sin falsos positivos',async()=>{
  const result=await analyze({albums:async()=>page([]),library:async()=>page([])},signal(),()=>{});
  assert.equal(result.complete,true);
  assert.equal(result.items.size,0);
});

test('interpreta sobres RPC por identificador, sin tomar otra respuesta',()=>{
  const body=JSON.stringify([['wrb.fr','otro','[]'],['wrb.fr','lcxiM',JSON.stringify([[],null])]]);
  assert.deepEqual(decodeEnvelope(")]}'\n100\n"+body,'lcxiM'),[[],null]);
  assert.throws(()=>decodeEnvelope('error','lcxiM'),/desconocido/);
});

test('valida estructura y claves de fotos y álbumes',()=>{
  const row=['foto',['https://lh3.googleusercontent.com/ficticia'],123,'clave'];
  assert.equal(parsePage([[row],null],'library').items[0].key,'clave');
  assert.equal(parsePage([null,[row],null,['album']],'album').items.length,1);
  assert.throws(()=>parsePage([[['foto']],null],'library'),/comparar/);
  assert.throws(()=>parsePage([], 'library'),/incompleta/);
  assert.throws(()=>parsePage([null,null,null,null],'album'),/acceso/);
  assert.throws(()=>parsePage([[],42],'library'),/Cursor/);
  assert.equal(parsePage([null,[], '', ['album']],'album').next,null);
  assert.equal(parsePage([[row]],'library').next,null);
  assert.equal(parsePage([null],'library').items.length,0);
});

test('miniaturas únicamente HTTPS de Google, nunca URLs arbitrarias',()=>{
  assert.equal(safeThumbnail('https://lh3.googleusercontent.com/ficticia'),'https://lh3.googleusercontent.com/ficticia');
  assert.equal(safeThumbnail('https://photos.fife.usercontent.google.com/ficticia'),'https://photos.fife.usercontent.google.com/ficticia');
  for(const value of ['javascript:alert(1)','https://googleusercontent.com.ejemplo.com/foto','http://lh3.googleusercontent.com/foto']) assert.equal(safeThumbnail(value),'');
});

test('rechaza resultados si cambia la cuenta durante la solicitud',async()=>{
  const originalWindow=globalThis.window;
  const originalLocation=globalThis.location;
  const originalFetch=globalThis.fetch;
  try {
    globalThis.window={WIZ_global_data:{oPEP7c:'cuenta-ficticia',eptZe:'/_/PhotosUi/',SNlM0e:'ficticio',FdrFJe:'ficticio',cfb2h:'ficticio'}};
    globalThis.location={origin:'https://photos.google.com',pathname:'/'};
    const api=createGoogleApi();
    globalThis.fetch=async()=>{
      window.WIZ_global_data.oPEP7c='otra-cuenta-ficticia';
      return {ok:true,text:async()=>JSON.stringify([['wrb.fr','lcxiM',JSON.stringify([[],null])]])};
    };
    await assert.rejects(api.library(null,signal()),/Cambió la cuenta/);
    await assert.rejects(api.albums(null,signal()),/Cambió la cuenta/);
  } finally {
    globalThis.window=originalWindow;
    globalThis.location=originalLocation;
    globalThis.fetch=originalFetch;
  }
});


test('filtros combinados por álbum, tipo y límites inclusivos de fecha',()=>{
  const state={members:new Set(['a']),complete:true};
  const photo={id:'a',video:false,timestamp:new Date('2026-10-04T23:59:59').getTime()};
  assert.equal(matchesFilters(photo,state,{album:'con-album',type:'photo',from:'2026-10-04',to:'2026-10-04'}),true);
  assert.equal(matchesFilters(photo,state,{album:'sin-album',type:'photo'}),false);
  assert.equal(matchesFilters(photo,state,{album:'all',type:'video'}),false);
  assert.equal(matchesFilters(photo,state,{album:'all',type:'photo',to:'2026-10-03'}),false);
  assert.equal(matchesFilters({...photo,timestamp:NaN},state,{from:'2026-10-01'}),false);
  assert.equal(matchesFilters({id:'b',video:true},state,{album:'sin-album',type:'video'}),true);
  assert.equal(matchesFilters({id:'b'}, {...state,complete:false},{album:'sin-album'}),false);
});

test('conserva todos los álbumes de una foto sin repetirlos por identificadores equivalentes',async()=>{
  const albums=[{id:'uno',title:'Viaje'},{id:'dos',title:'Familia'}];
  const state=await analyze({albums:async()=>page(albums),album:async()=>page([item('en-album','clave')]),library:async()=>page([item('en-biblioteca','clave')])},signal(),()=>{});
  assert.deepEqual(albumsFor(state.items.get('en-biblioteca'),state).map(a=>a.title),['Viaje','Familia']);
  assert.equal(albumsFor({id:'en-album',key:'clave'},state).length,2);
});
