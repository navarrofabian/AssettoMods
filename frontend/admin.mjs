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
