/* Shared client-side entry lock. This is not server authentication. */
(function(g){
'use strict';
const KEY='mathkoni-entry-session-v1';
const TOKEN='69f34229488d7d9aa206591f841a19adcb256b2924a99a47';
const SALT='04cf7aaaa90b23ae08b51de76dcb6a7b';
const HASH='e254cab4fc24421acb5ae67bfdc56b247075dcb0d7e54e3d83225d81060aa99b';
const fromHex=s=>Uint8Array.from(s.match(/../g),x=>parseInt(x,16));
const toHex=a=>Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');
const PREF='mathkoni-entry-password-v1';
function config(){
 const raw=localStorage.getItem(PREF);
 if(raw===null)return {salt:SALT,hash:HASH,token:TOKEN};
 const p=JSON.parse(raw);
 if(!p||p.version!==1||! /^[0-9a-f]{32}$/.test(p.salt)||! /^[0-9a-f]{64}$/.test(p.hash)||! /^[0-9a-f]{48}$/.test(p.token))throw Error('비밀번호 설정을 읽을 수 없습니다.');
 return p;
}
function allowed(){try{return sessionStorage.getItem(KEY)===config().token}catch(_){return false}}
async function digest(password,salt){
 if(!g.crypto?.subtle)throw Error('HTTPS 보안 연결을 확인하세요.');
 const k=await g.crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await g.crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:fromHex(salt),iterations:150000},k,256);
 return toHex(new Uint8Array(bits));
}
async function unlock(password){
 const p=config(),hash=await digest(password,p.salt);
 if(hash!==p.hash||config().token!==p.token)return false;
 sessionStorage.setItem(KEY,p.token);return allowed();
}
async function changePassword(oldPassword,newPassword){
 if(!allowed())throw Error('먼저 로그인하세요.');
 if(typeof newPassword!=='string'||newPassword.length<8||newPassword.length>128||!newPassword.trim())throw Error('새 비밀번호는 8~128자로 입력하세요.');
 if(oldPassword===newPassword)throw Error('현재 비밀번호와 다른 비밀번호를 입력하세요.');
 const before=localStorage.getItem(PREF),p=config();
 if(await digest(oldPassword,p.salt)!==p.hash)throw Error('현재 비밀번호가 일치하지 않습니다.');
 const salt=toHex(g.crypto.getRandomValues(new Uint8Array(16))),token=toHex(g.crypto.getRandomValues(new Uint8Array(24)));
 const next={version:1,salt,hash:await digest(newPassword,salt),token};
 if(localStorage.getItem(PREF)!==before||!allowed())throw Error('다른 창에서 설정이 변경되었습니다. 다시 로그인하세요.');
 const encoded=JSON.stringify(next);localStorage.setItem(PREF,encoded);
 if(localStorage.getItem(PREF)!==encoded)throw Error('비밀번호 변경 저장 실패');
 sessionStorage.setItem(KEY,token);return allowed();
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
g.mathkoniEntry={allowed,unlock,lock,requireTool,changePassword,PREF};
})(globalThis);