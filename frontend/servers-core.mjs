const idPattern=/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}$/;
function line(value,label){const s=String(value??'').trim();if(/[\r\n\0\[\]]/.test(s))throw Error(`${label} contiene caracteres no permitidos.`);return s;}
function identifier(value,label){const s=line(value,label);if(!idPattern.test(s)||s==='.'||s==='..')throw Error(`Elegí ${label} en la lista de contenido instalado (identificador inválido).`);return s;}
function skinIdentifier(value,label){const s=line(value,label);if(!/^[\p{L}\p{M}\p{N}# _.,-]{1,100}$/u.test(s)||s==='.'||s==='..')throw Error(`Elegí ${label} en la lista de skins instaladas.`);return s;}
function number(value,label,min,max){const n=Number(value);if(!Number.isInteger(n)||n<min||n>max)throw Error(`${label} debe estar entre ${min} y ${max}.`);return n;}
function url(value,label){const s=String(value||'').trim();if(!s)return '';try{const u=new URL(s);if(u.protocol!=='https:'||u.username||u.password)throw Error();return u.href;}catch{throw Error(`El enlace de ${label} debe ser una URL HTTPS válida.`);}}
export function driveDownload(id){if(!/^[A-Za-z0-9_-]{10,150}$/.test(id||''))return '';return 'https://drive.usercontent.google.com/download?export=download&confirm=t&id='+encodeURIComponent(id);}
function words(value){return [...new Set(String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\.(zip|rar|7z)$/,'').replace(/(?:[\s_.-]v\d+(?:[\s_.-]\d+)*)$/,'').split(/[^a-z0-9]+/).filter(Boolean))];}
// A guess is only accepted when it is unique and substantially matches the name.
export function matchInstalled(value,items){
  if(!value||!Array.isArray(items))return '';
  if(items.includes(value))return value;
  const source=words(value);if(!source.length)return '';
  if(source.length<2)return '';
  const matches=items.filter(id=>{const target=words(id);return target.length===source.length&&source.every(t=>target.includes(t));});
  return matches.length===1?matches[0]:'';
}
export function generateServerFiles(p){
  const name=line(p.name,'Nombre del servidor');if(!name||name.length>120)throw Error('Indicá un nombre de servidor.');
  const track=identifier(p.trackId,'circuito'),layout=p.layout?identifier(p.layout,'variante'):'';
  const max=number(p.maxClients,'Cantidad de jugadores',1,64),udp=number(p.udpPort,'Puerto UDP',1,65535),tcp=number(p.tcpPort,'Puerto TCP',1,65535),http=number(p.httpPort,'Puerto HTTP',1,65535);
  if(!Array.isArray(p.cars)||!p.cars.length||p.cars.length>64)throw Error('Agregá al menos un auto.');
  if(p.cars.length>max)throw Error('La cantidad de puestos debe alcanzar para todos los autos elegidos.');
  const cars=p.cars.map((c,i)=>({id:identifier(c.id,`auto ${i+1}`),skin:skinIdentifier(c.skin,`skin del auto ${i+1}`),url:url(c.url,`auto ${i+1}`),version:line(c.version,'Versión'),availableSkins:Array.isArray(c.availableSkins)?c.availableSkins.slice(0,2000).map(x=>({id:skinIdentifier(typeof x==='string'?x:x.id,'skin disponible'),driver:typeof x==='object'&&typeof x.driver==='string'?x.driver.slice(0,100):''})):[]}));
  const trackUrl=url(p.trackUrl,'circuito'),trackVersion=line(p.trackVersion,'Versión del circuito');
  const minutes=number(p.practiceMinutes,'Duración de práctica',1,1440),qualify=number(p.qualifyMinutes,'Clasificación',0,1440),laps=number(p.raceLaps,'Vueltas de carrera',0,999),sun=number(p.sunAngle,'Ángulo del sol',-80,80);
  const ambient=number(p.ambient,'Temperatura',-20,60),weather=line(p.weather,'Clima');
  if(!['3_clear_type=15','5_light_clouds_type=17','7_heavy_clouds_type=18'].includes(weather))throw Error('Clima inválido.');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.timeOfDay||''))throw Error('Indicá una hora válida.');
  const [hours,mins]=p.timeOfDay.split(':').map(Number),seconds=hours*3600+mins*60,mult=number(p.timeMultiplier,'Multiplicador de tiempo',0,100);
  if(!['none','auto','fixed'].includes(p.aiMode))throw Error('Modo de IA inválido.');
  if(p.gridTest && (p.aiMode!=='auto'||max<2||qualify>0||laps>0))throw Error('La prueba de grilla requiere IA automática, al menos dos puestos y solo práctica.');
  if(p.gridTest)number(p.gridTestSlot,'Cajón de grilla',0,999);
  const content={cars:{}};for(const c of cars){if(!c.url)continue;const existing=content.cars[c.id];if(existing&&existing.url!==c.url)throw Error(`El auto ${c.id} tiene enlaces distintos.`);content.cars[c.id]={url:c.url,...(c.version?{version:c.version}:{})};}
  if(trackUrl)content.track={url:trackUrl,...(trackVersion?{version:trackVersion}:{})};
  const session=['[PRACTICE]','NAME=Práctica',`TIME=${minutes}`,'IS_OPEN=1',`INFINITE=${p.infinite?'1':'0'}`];
  if(qualify>0){session.push('','[QUALIFY]','NAME=Clasificación',`TIME=${qualify}`,'IS_OPEN=1');}
  if(laps>0){session.push('','[RACE]','NAME=Carrera',`LAPS=${laps}`,'WAIT_TIME=60','IS_OPEN=0');}
  const cfg=['[SERVER]',`NAME=${name}`,`TRACK=${track}`,`CONFIG_TRACK=${layout}`,`CARS=${[...new Set(cars.map(c=>c.id))].join(';')}`,`MAX_CLIENTS=${max}`,`UDP_PORT=${udp}`,`TCP_PORT=${tcp}`,`HTTP_PORT=${http}`,`SUN_ANGLE=${sun}`,'CLIENT_SEND_INTERVAL_HZ=20','LOOP_MODE=1',`REGISTER_TO_LOBBY=${p.publicLobby?'1':'0'}`,'FUEL_RATE=100','DAMAGE_MULTIPLIER=0','TYRE_WEAR_RATE=100','ALLOWED_TYRES_OUT=-1','ABS_ALLOWED=1','TC_ALLOWED=1','STABILITY_ALLOWED=0','AUTOCLUTCH_ALLOWED=0',`TYRE_BLANKETS_ALLOWED=${p.tyreBlankets===true?'1':'0'}`,'FORCE_VIRTUAL_MIRROR=0',`TIME_OF_DAY_MULT=${mult}`,'','[WEATHER_0]',`GRAPHICS=${weather}_time=${seconds}_mult=${mult}`,`BASE_TEMPERATURE_AMBIENT=${ambient}`,'BASE_TEMPERATURE_ROAD=6','VARIATION_AMBIENT=2','VARIATION_ROAD=1','WIND_BASE_SPEED_MIN=0','WIND_BASE_SPEED_MAX=0','WIND_BASE_DIRECTION=0','WIND_VARIATION_DIRECTION=0','',...session,''].join('\n');
  const usedSkins=new Set(),skinCounts=new Map(),usedDrivers=new Set(),candidates=cars.map(c=>{const all=[{id:c.skin,driver:''},...c.availableSkins];const seen=new Set();return all.filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true;}).map(x=>{const details=c.availableSkins.find(y=>y.id===x.id);return {...x,driver:details?.driver||x.driver};});});
  const entries=Array.from({length:max},(_,i)=>{let choice=null;const ordered=Array.from({length:cars.length},(_,n)=>(i+n)%cars.length);for(const tier of [0,1,2]){for(const idx of ordered){const c=cars[idx];for(const skin of candidates[idx]){const key=c.id+'\0'+skin.id,driver=skin.driver.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),fresh=!usedSkins.has(key),freshDriver=!driver||!usedDrivers.has(driver);if((tier===0&&fresh&&freshDriver)||(tier===1&&fresh)){choice={c,skin,driver,key};break;}if(tier===2&&(!choice||(skinCounts.get(key)||0)<(skinCounts.get(choice.key)||0)))choice={c,skin,driver,key};}if(choice&&tier<2)break;}if(choice)break;}usedSkins.add(choice.key);skinCounts.set(choice.key,(skinCounts.get(choice.key)||0)+1);if(choice.driver)usedDrivers.add(choice.driver);const mode=p.gridTest?(i===1?'fixed':'none'):p.aiMode;return [`[CAR_${i}]`,`MODEL=${choice.c.id}`,`SKIN=${choice.skin.id}`,'BALLAST=0','RESTRICTOR=0',`AI=${mode}`,''].join('\n');}).join('\n');
  const extra=['# Revisá y combiná estas opciones con tu extra_cfg.yml existente.','EnableServerDetails: true',`EnableAi: ${p.aiMode!=='none'}`,''].join('\n');
  const warnings=[];if(!trackUrl||cars.some(c=>!c.url))warnings.push('Hay mods sin enlace de descarga.');
  if([trackUrl,...cars.map(c=>c.url)].some(u=>u.includes('drive.google.com')||u.includes('drive.usercontent.google.com')))warnings.push('Los enlaces de Drive necesitan una prueba real en Content Manager: pueden requerir acceso o confirmación.');
  if(p.aiMode!=='none')warnings.push('La IA también requiere datos de pista y configuración compatibles en AssettoServer.');
  if(p.aiMode==='fixed')warnings.push('Todos los puestos serán de IA; los jugadores no tendrán un puesto normal libre.');
  if(p.infinite&&(qualify||laps))warnings.push('La práctica infinita no avanzará automáticamente a clasificación o carrera.');
  if(p.qualifyMinutes||p.raceLaps)warnings.push('Clasificación y carrera son funciones experimentales de AssettoServer.');
  return {files:{'server_cfg.ini':cfg,'entry_list.ini':entries,'extra_cfg.yml':extra,'content.json':JSON.stringify(content,null,2)+'\n'},warnings};
}
