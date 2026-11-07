import {createPublicKey,verify} from 'node:crypto';
const project='assettomods-ea691';
const admins=new Set(['navarrofabian315@gmail.com','aguspaz133@gmail.com']);
export function verifyFirebaseToken(token,certificates,now=Math.floor(Date.now()/1000)){
  if(typeof token!=='string'||token.length>12000)throw Error('Token inválido');
  const parts=token.split('.');if(parts.length!==3)throw Error('Token inválido');
  let header,claims;try{header=JSON.parse(Buffer.from(parts[0],'base64url'));claims=JSON.parse(Buffer.from(parts[1],'base64url'));}catch{throw Error('Token inválido');}
  if(header.alg!=='RS256'||typeof header.kid!=='string'||!Object.hasOwn(certificates,header.kid))throw Error('Firma inválida');
  let valid=false;try{valid=verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey(certificates[header.kid]),Buffer.from(parts[2],'base64url'));}catch{}
  if(!valid||claims.aud!==project||claims.iss!==`https://securetoken.google.com/${project}`||typeof claims.exp!=='number'||claims.exp<=now||typeof claims.iat!=='number'||claims.iat>now+60||typeof claims.sub!=='string'||!claims.sub||claims.email_verified!==true||claims.firebase?.sign_in_provider!=='google.com'||!admins.has(claims.email))throw Error('Cuenta no autorizada');
  return {email:claims.email,uid:claims.sub};
}
