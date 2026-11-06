import test from 'node:test';
import assert from 'node:assert/strict';
import {readFavorites,writeFavorite,validateDatabaseUrl} from '../frontend/favorites.mjs';

test('solo admite URLs de Firebase y filtra favoritos inválidos', async () => {
  assert.equal(validateDatabaseUrl('https://ejemplo.firebaseio.com'),true);
  assert.equal(validateDatabaseUrl('https://firebaseio.com.ejemplo.org'),false);
  const original=globalThis.fetch;
  globalThis.fetch=async()=>({ok:true,json:async()=>({'abcdefghij':true,'otro':true,'klmnopqrst':false})});
  try { assert.deepEqual(await readFavorites('https://ejemplo.firebaseio.com'),['abcdefghij']); } finally {globalThis.fetch=original;}
});
test('actualiza solamente el mod elegido y comunica fallos', async () => {
  const original=globalThis.fetch;let request;
  globalThis.fetch=async(url,options)=>{request={url,options};return {ok:true};};
  try {
    await writeFavorite('https://ejemplo.firebaseio.com','abcdefghij',true);
    assert.equal(request.options.method,'PUT');assert.match(request.url,/abcdefghij\.json$/);
    await writeFavorite('https://ejemplo.firebaseio.com','abcdefghij',false);
    assert.equal(request.options.method,'DELETE');
    globalThis.fetch=async()=>({ok:false});
    await assert.rejects(writeFavorite('https://ejemplo.firebaseio.com','abcdefghij',true));
  } finally {globalThis.fetch=original;}
});
