/* Load the bundled spreadsheet engine only when an export needs it. */
(function(g){
'use strict';
let pending=null;
const src=new URL('sheetjs-0.18.5/xlsx.full.min.js',document.currentScript.src).href;
g.mathkoniLoadXlsx=function(){
 if(g.XLSX?.utils?.book_new)return Promise.resolve(g.XLSX);
 if(pending)return pending;
 pending=new Promise((resolve,reject)=>{
  const s=document.createElement('script');s.src=src;s.async=true;
  s.onload=()=>{if(g.XLSX?.utils?.book_new)resolve(g.XLSX);else{pending=null;s.remove();reject(Error('엑셀 모듈 초기화 실패'))}};
  s.onerror=()=>{pending=null;s.remove();reject(Error('엑셀 모듈 로드 실패 · 다시 시도하세요.'))};
  document.head.append(s);
 });
 return pending;
};
})(globalThis);