import assert from 'node:assert/strict';
import test from 'node:test';
import { destino } from '../src/sidebar/urls.js';

test('acepta enlaces de la cuenta y del tipo indicado', () => {
  const foto = 'https://photos.google.com/u/2/photo/abc-1';
  assert.equal(destino(foto,'photo'),foto);
  assert.equal(destino(foto,'album'),undefined);
  for (const url of ['https://example.org/photo/a','https://usuario@photos.google.com/photo/a','https://photos.google.com/photo/a?x=1']) {
    assert.equal(destino(url,'photo'),undefined);
  }
});
test('limita las miniaturas a servidores de imágenes de Google', () => {
  const url = 'https://lh3.googleusercontent.com/imagen';
  assert.equal(destino(url,'miniatura'),url);
  assert.equal(destino('https://example.org/imagen','miniatura'),undefined);
});
