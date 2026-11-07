export function startupMessage(output){
  const text=String(output||'');
  if(/No track params found/i.test(text))return 'El circuito no tiene coordenadas o zona horaria configuradas en AssettoServer. Hay que agregar sus datos de ubicación.';
  if(/address already in use|only one usage of each socket address|failed to bind/i.test(text))return 'Uno de los puertos del servidor ya está en uso. Cerrá el otro servidor o elegí puertos diferentes en opciones avanzadas.';
  if(/car checksum|missing.*data\.acd/i.test(text))return 'Faltan datos de uno de los autos en el servidor. Volvé a agregar el mod a la sesión.';
  return 'AssettoServer se cerró al iniciar. Revisá el contenido y los registros de la configuración aislada.';
}
