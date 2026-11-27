/* mathkoni local assessment bridge. No network or account synchronization. */
(function(g){
'use strict';
const SOURCE='mathkoni-assessment-pdf-v1',TARGET='mathkoni-achievement-target-v1';
const norm=v=>String(v??'').normalize('NFC').replace(/\s+/g,' ').trim(),key=(...x)=>JSON.stringify(x);
const scope=r=>key(r.year,r.sem,r.grade,r.subject),area=r=>key(r.kind||'수행평가',r.area),rowkey=r=>key(scope(r),area(r),r.cls,r.num);
const noOf=r=>String(r.grade)+String(r.cls)+String(r.num).padStart(2,'0');
function studentNo(v){const s=norm(v);if(!/^[1-9]\d{3,4}$/.test(s)||+s.slice(1,-2)<1||+s.slice(-2)<1)return '';return s[0]+Number(s.slice(1,-2))+s.slice(-2)}
const classOf=no=>Number(no.slice(1,-2));
const valid=r=>r&&['정기시험','수행평가'].includes(r.kind||'수행평가')&&Number.isInteger(r.year)&&r.year>=1900&&r.year<=2200&&[1,2].includes(r.sem)&&Number.isInteger(r.grade)&&r.grade>=1&&r.grade<=9&&Number.isInteger(r.cls)&&r.cls>=1&&r.cls<=99&&Number.isInteger(r.num)&&r.num>=1&&r.num<=99&&norm(r.name)&&norm(r.subject)&&norm(r.area)&&Number.isFinite(r.max)&&r.max>0&&(r.score===null||Number.isFinite(r.score)&&r.score>=0&&r.score<=r.max);
function checkRows(rows){if(!Array.isArray(rows)||!rows.every(valid)||new Set(rows.map(rowkey)).size!==rows.length)throw Error('통합관리 기록 형식 또는 중복 오류');return rows}
function mergeRecords(old,incoming){
 checkRows(old);checkRows(incoming);const rows=new Map(old.map(r=>[rowkey(r),r])),names=new Map(),maxes=new Map();
 for(const r of [...old,...incoming]){const n=key(scope(r),r.cls,r.num),a=key(scope(r),area(r));if(names.has(n)&&names.get(n)!==norm(r.name))throw Error(noOf(r)+' 학번의 이름이 일치하지 않습니다.');names.set(n,norm(r.name));if(maxes.has(a)&&maxes.get(a)!==r.max)throw Error(r.area+'의 기존 만점과 다릅니다. 같은 평가 만점으로 환산해 주세요.');maxes.set(a,r.max);}
 let added=0,updated=0;for(const r of incoming){const k=rowkey(r),o=rows.get(k);if(!o)added++;else if(o.score!==r.score||o.name!==r.name||o.max!==r.max)updated++;rows.set(k,r)}
 return {rows:[...rows.values()],added,updated};
}
function syncModel(target,oldRows,newRows){
 checkRows(oldRows);checkRows(newRows);
 if(!target||!target.sourceScope||!Array.isArray(target.evals)||!Array.isArray(target.students)||!Array.isArray(target.levels)||!target.levels.length)return {changed:false,count:0,data:target};
 const t=JSON.parse(JSON.stringify(target)),prior=new Map(oldRows.filter(r=>scope(r)===t.sourceScope).map(r=>[rowkey(r),r])),next=new Map(newRows.filter(r=>scope(r)===t.sourceScope).map(r=>[rowkey(r),r]));
 const by=new Map();for(const st of t.students){const no=studentNo(st.no);if(!no){if(norm(st.no)||norm(st.name))throw Error('성취도 명단에 올바르지 않은 학번이 있습니다.');continue}if(by.has(no))throw Error('성취도 중복 학번: '+no);by.set(no,st)}
 let count=0,added=0;
 for(const e of t.evals){
  if(!e.sourceKey||e.liveSync===false)continue;
  const configured=Array.isArray(e.linkedClasses),classes=new Set(configured?e.linkedClasses:[...by.keys()].map(classOf));
  const matches=[...next.values()].filter(r=>area(r)===e.sourceKey&&classes.has(r.cls));
  for(const r of matches){
   if(Number(e.max)!==r.max)throw Error(e.name+' 만점 불일치 · 성취도 반영 설정을 확인하세요.');
   const no=noOf(r);let st=by.get(no);
   if(!st){if(!configured)continue;st={id:g.crypto?.randomUUID?.()||('s'+Date.now().toString(36)+Math.random().toString(36).slice(2)),no,name:r.name,target:t.levels[0].id,scores:Object.fromEntries(t.evals.map(x=>[x.id,'']))};t.students.push(st);by.set(no,st);added++}
   if(norm(st.name)&&norm(st.name)!==norm(r.name))throw Error(no+' 성취도 학생 이름 불일치');
   if(!norm(st.name))st.name=r.name;
   st.scores=st.scores||{};const value=r.score===null?'':String(r.score);if(String(st.scores[e.id]??'')!==value){st.scores[e.id]=value;count++}
  }
  // A deliberate removal in the integrated source clears that linked score only.
  for(const [k,r] of prior){if(area(r)!==e.sourceKey||!classes.has(r.cls)||next.has(k))continue;const st=by.get(noOf(r));if(st&&norm(st.name)===norm(r.name)&&String(st.scores?.[e.id]??'')!==''){st.scores[e.id]='';count++}}
 }
 if(count||added){t.students=t.students.filter(s=>norm(s.no)||norm(s.name)||Object.values(s.scores||{}).some(v=>v!=null&&String(v)!==''));t.students.sort((a,b)=>studentNo(a.no).localeCompare(studentNo(b.no),'ko',{numeric:true}));if(!t.students.some(s=>s.id===t.selected))t.selected=t.students[0]?.id||'';t.savedAt=new Date().toISOString();}
 return {data:t,changed:!!(count||added),count,added};
}
function sync(oldRows,newRows){
 const raw=localStorage.getItem(TARGET);if(raw===null)return {changed:false,count:0,added:0};const result=syncModel(JSON.parse(raw),oldRows,newRows);if(!result.changed)return result;
 if(localStorage.getItem(TARGET)!==raw)throw Error('성취도 자료가 다른 창에서 변경되었습니다.');
 localStorage.setItem(TARGET+'-previous',raw);
 if(localStorage.getItem(TARGET)!==raw)throw Error('성취도 자료 변경 감지');
 const next=JSON.stringify(result.data);localStorage.setItem(TARGET,next);if(localStorage.getItem(TARGET)!==next)throw Error('성취도 저장 확인 실패');return result;
}
function publish(incoming,expected){
 const raw=localStorage.getItem(SOURCE);if(raw!==expected)throw Error('통합관리 자료가 다른 창에서 변경되었습니다. 다시 열어 주세요.');
 const old=raw===null?[]:checkRows(JSON.parse(raw));const result=mergeRecords(old,incoming),next=JSON.stringify(result.rows);
 if(raw!==next){if(raw!==null)localStorage.setItem(SOURCE+'-previous',raw);if(localStorage.getItem(SOURCE)!==raw)throw Error('통합관리 자료 변경 감지');localStorage.setItem(SOURCE,next);if(localStorage.getItem(SOURCE)!==next)throw Error('통합관리 저장 확인 실패');}
 try{result.sync=sync(old,result.rows)}catch(e){result.syncError=e.message}
 return result;
}
g.mathkoniBridge={SOURCE,TARGET,scope,area,rowkey,studentNo,noOf,classOf,checkRows,mergeRecords,syncModel,sync,publish};
})(globalThis);