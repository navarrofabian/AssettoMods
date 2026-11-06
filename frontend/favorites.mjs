export function validateDatabaseUrl(value) {
  return typeof value === 'string' && /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:firebaseio\.com|firebasedatabase\.app)$/i.test(value);
}

export async function readFavorites(databaseUrl) {
  if (!validateDatabaseUrl(databaseUrl)) throw new Error('Base de favoritos no configurada');
  const response = await fetch(`${databaseUrl}/favorites.json`, {cache:'no-store'});
  if (!response.ok) throw new Error('No se pudieron leer los favoritos');
  const data = await response.json();
  if (data !== null && (typeof data !== 'object' || Array.isArray(data))) throw new Error('Respuesta de favoritos inválida');
  return Object.keys(data || {}).filter(id => /^[\w-]{10,150}$/.test(id) && data[id] === true);
}

export async function writeFavorite(databaseUrl, id, selected) {
  if (!validateDatabaseUrl(databaseUrl) || !/^[\w-]{10,150}$/.test(id) || typeof selected !== 'boolean') throw new Error('Favorito inválido');
  const response = await fetch(`${databaseUrl}/favorites/${encodeURIComponent(id)}.json`, selected ? {method:'PUT',headers:{'content-type':'application/json'},body:'true'} : {method:'DELETE'});
  if (!response.ok) throw new Error('No se pudo guardar el favorito');
}
