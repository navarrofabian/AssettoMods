import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyFirebaseToken} from '../local-agent/auth.mjs';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const keys={test:publicKey.export({type:'spki',format:'pem'})},now=1700000000;
const claims={aud:'assettomods-ea691',iss:'https://securetoken.google.com/assettomods-ea691',sub:'uid',iat:now-1,exp:now+100,email:'navarrofabian315@gmail.com',email_verified:true,firebase:{sign_in_provider:'google.com'}};
function token(value,key=privateKey){let h=Buffer.from(JSON.stringify({alg:'RS256',kid:'test'})).toString('base64url'),p=Buffer.from(JSON.stringify(value)).toString('base64url');return h+'.'+p+'.'+sign('RSA-SHA256',Buffer.from(h+'.'+p),key).toString('base64url');}
test('el agente acepta únicamente tokens de Google firmados de los dos administradores',()=>{
  assert.equal(verifyFirebaseToken(token(claims),keys,now).email,claims.email);
  assert.throws(()=>verifyFirebaseToken(token({...claims,email:'otro@gmail.com'}),keys,now));
  assert.throws(()=>verifyFirebaseToken(token({...claims,exp:now-1}),keys,now));
  assert.throws(()=>verifyFirebaseToken(token({...claims,email_verified:false}),keys,now));
  assert.throws(()=>verifyFirebaseToken(token({...claims,firebase:{sign_in_provider:'password'}}),keys,now));
  const other=generateKeyPairSync('rsa',{modulusLength:2048});assert.throws(()=>verifyFirebaseToken(token(claims,other.privateKey),keys,now));
});
