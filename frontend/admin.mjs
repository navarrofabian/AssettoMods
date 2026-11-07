const root='https://assettomods-ea691-default-rtdb.firebaseio.com';
const admins=new Set(['navarrofabian315@gmail.com','aguspaz133@gmail.com']);
let auth, sdk, database, databaseSdk;
export async function setupAuth(apiKey, onChange){
  if(!apiKey) throw Error('Falta configurar el acceso con Google.');
  const appSdk=await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js');
  sdk=await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js');
  const app=appSdk.initializeApp({apiKey,authDomain:'assettomods-ea691.firebaseapp.com',projectId:'assettomods-ea691'});
  auth=sdk.getAuth(app);
  databaseSdk=await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js');
  database=databaseSdk.getDatabase(app,root);
  sdk.onAuthStateChanged(auth,user=>onChange(user&&user.emailVerified&&admins.has(user.email?.toLowerCase())?user:null,user));
}
export async function login(){return sdk.signInWithPopup(auth,new sdk.GoogleAuthProvider());}
export async function logout(){return sdk.signOut(auth);}
async function read(path){let r=await fetch(root+path+'.json',{cache:'no-store'});if(!r.ok)throw Error('No se pudieron leer las ediciones.');return r.json();}
async function write(path,value){if(!auth?.currentUser)throw Error('Iniciá sesión primero.');try{await databaseSdk.set(databaseSdk.ref(database,path),value);}catch{throw Error('No se pudo guardar: revisá los permisos de administrador.');}}
export const readEdits=()=>read('/libraryEdits');
export const writeEdit=(id,value)=>write('/libraryEdits/'+encodeURIComponent(id),value);
export const readCoverIndex=()=>read('/customCoverIndex');
export const readCustomCovers=id=>read('/customCovers/'+encodeURIComponent(id));

// Keep the original gallery intact; cloud replacements refer to a position and
// new images have independent IDs, so simultaneous additions do not overwrite each other.
export function mergeCovers(original,custom){
  const base=Array.isArray(original)?original:[];
  const result=base.map((image,index)=>{
    const value=custom?.overrides?.[index];
    return typeof value==='string'&&value.startsWith('data:image/webp;base64,')
      ? {url:value,version:1,cloudRef:{type:'overrides',key:String(index)}}
      : {...image,cloudRef:{type:'overrides',key:String(index)}};
  });
  for(const key of Object.keys(custom?.added||{}).sort()){
    const value=custom.added[key];
    if(typeof value==='string'&&value.startsWith('data:image/webp;base64,')) result.push({url:value,version:1,cloudRef:{type:'added',key}});
  }
  return result;
}

export async function saveCover(id,ref,value){
  if(!auth?.currentUser)throw Error('Iniciá sesión primero.');
  if(!/^[A-Za-z0-9_-]{10,150}$/.test(id)||!['overrides','added'].includes(ref?.type)||!/^[A-Za-z0-9_-]{1,70}$/.test(ref?.key||'')||typeof value!=='string'||!value.startsWith('data:image/webp;base64,')||value.length>250000)throw Error('Imagen inválida.');
  try {
    await databaseSdk.set(databaseSdk.ref(database,`customCoverIndex/${id}`),true);
    await databaseSdk.set(databaseSdk.ref(database,`customCovers/${id}/${ref.type}/${ref.key}`),value);
  } catch { throw Error('No se pudo guardar la imagen. Revisá la conexión y los permisos.'); }
}

export async function compressImage(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>15*1024*1024)throw Error('Elegí una imagen JPG, PNG o WebP de hasta 15 MB.');
  let image;
  try { image=await createImageBitmap(file); } catch { throw Error('No se pudo leer la imagen.'); }
  try {
    if(image.width*image.height>40000000)throw Error('La imagen tiene demasiados píxeles.');
    const canvas=document.createElement('canvas'),ratio=Math.min(1,960/image.width,540/image.height);
    canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));
    const context=canvas.getContext('2d');if(!context)throw Error('No se pudo procesar la imagen.');
    context.drawImage(image,0,0,canvas.width,canvas.height);
    for(const quality of [.78,.65,.5,.35,.2]){
      const output=canvas.toDataURL('image/webp',quality);
      if(output.startsWith('data:image/webp;base64,')&&output.length<=250000)return output;
    }
    throw Error('No se pudo reducir la imagen lo suficiente; elegí una más pequeña.');
  } finally { image.close(); }
}
