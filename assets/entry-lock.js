/* Shared client-side entry lock. This is not server authentication. */
(function(g){
'use strict';
const KEY='mathkoni-entry-session-v1';
const TOKEN='69f34229488d7d9aa206591f841a19adcb256b2924a99a47';
const SALT='04cf7aaaa90b23ae08b51de76dcb6a7b';
const HASH='e254cab4fc24421acb5ae67bfdc56b247075dcb0d7e54e3d83225d81060aa99b';
const fromHex=s=>Uint8Array.from(s.match(/../g),x=>parseInt(x,16));
const toHex=a=>Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');
function allowed(){try{return sessionStorage.getItem(KEY)===TOKEN}catch(_){return false}}
async function unlock(password){
 if(!g.crypto?.subtle)throw Error('HTTPS 보안 연결을 확인하세요.');
 const key=await g.crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await g.crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:fromHex(SALT),iterations:150000},key,256);
 if(toHex(new Uint8Array(bits))!==HASH)return false;
 sessionStorage.setItem(KEY,TOKEN);return allowed();
}
function lock(){sessionStorage.removeItem(KEY)}
function requireTool(){
 if(allowed())return true;
 const page=location.pathname.split('/').pop();
 const next=new URL('../',location.href);next.hash='tool='+encodeURIComponent('/tools/'+page);
 document.documentElement.style.visibility='hidden';
 if(window.parent===window){location.replace(next.href)}else{try{window.parent.location.replace(next.href)}catch(_){location.replace(next.href)}}
 return false;
}
g.mathkoniEntry={allowed,unlock,lock,requireTool};
})(globalThis);