// Data layer: live collections, load state, change events and read-only queries. No DOM.
var F=[],M=[],D=[],DF=[],MF=[],UF=new Set(),UD=new Set(),LOADED={f:false,m:false,d:false,df:false,mf:false};
var TF=[],TM=[],TD=[],TDF=[],TMF=[];

// Change events. fn(what, err) where what is a collection name ('folders', 'moms', 'docs',
// 'docfolders', 'momfolders'), 'loaded' (once, when all five have arrived), 'error' (a listener
// failed), or a session event from session.js ('guest', 'role', 'access', 'users').
var Store={
  _fns:[],
  onChange:function(fn){Store._fns.push(fn);},
  _emit:function(what,err){Store._fns.slice().forEach(function(fn){fn(what,err);});}
};

var _chkLoadDone=false;function chkLoad(){if(_chkLoadDone)return;if(LOADED.f&&LOADED.m&&LOADED.d&&LOADED.df&&LOADED.mf){_chkLoadDone=true;_autopurge();Store._emit('loaded');}}
var _listenersStarted=false;
function startListeners(){
  if(_listenersStarted)return;_listenersStarted=true;
  db.collection('folders').onSnapshot(snap=>{var all=snap.docs.map(d=>d.data());F=all.filter(f=>!f.deleted);TF=all.filter(f=>f.deleted);LOADED.f=true;chkLoad();Store._emit('folders');},e=>Store._emit('error',e));
  db.collection('moms').onSnapshot(snap=>{var all=snap.docs.map(d=>d.data());M=all.filter(m=>!m.deleted);TM=all.filter(m=>m.deleted);LOADED.m=true;chkLoad();Store._emit('moms');},e=>Store._emit('error',e));
  db.collection('docs').onSnapshot(snap=>{var all=snap.docs.map(d=>d.data());D=all.filter(d=>!d.deleted);TD=all.filter(d=>d.deleted);LOADED.d=true;chkLoad();Store._emit('docs');},e=>Store._emit('error',e));
  db.collection('docfolders').onSnapshot(snap=>{var all=snap.docs.map(d=>d.data());DF=all.filter(df=>!df.deleted);TDF=all.filter(df=>df.deleted);LOADED.df=true;chkLoad();Store._emit('docfolders');},e=>Store._emit('error',e));
  db.collection('momfolders').onSnapshot(snap=>{var all=snap.docs.map(d=>d.data());MF=all.filter(mf=>!mf.deleted);TMF=all.filter(mf=>mf.deleted);LOADED.mf=true;chkLoad();Store._emit('momfolders');},e=>Store._emit('error',e));
}
// Live updates for one MoM (the open editor). Returns the unsubscribe function.
function watchMom(id,fn){return db.collection('moms').doc(id).onSnapshot(fn);}

function docAddedValue(d){var v=d&&d.added;if(!v)return 0;if(typeof v==='number')return v;if(v&&typeof v.toMillis==='function')return v.toMillis();var n=new Date(v).getTime();return Number.isNaN(n)?0:n;}
function gf(id){return F.find(f=>f.id===id);}
function kids(pid){return F.filter(f=>f.parent===pid).sort((a,b)=>(a.name||'').localeCompare((b.name||''),undefined,{sensitivity:'base'}));}
function momsOf(fid){return M.filter(m=>m.folderId===fid);}
function docsOf(fid){return D.filter(d=>d.folderId===fid);}
function pathTo(id){var p=[],c=gf(id);while(c){p.unshift(c.id);c=c.parent?gf(c.parent):null;}return p;}
function cnt(fid){return kids(fid).length+momsOf(fid).length+docsOf(fid).length;}
function folderLabel(id){var p=[],c=gf(id);while(c){p.unshift(c.name);c=c.parent?gf(c.parent):null;}return p.join(' / ');}
function docFoldersOf(fid){return DF.filter(df=>df.folderId===fid);}
function docsOfDF(dfid){return D.filter(d=>d.docFolderId===dfid);}
function docsUngrp(fid){return D.filter(d=>d.folderId===fid&&!d.docFolderId);}
function momFoldersOf(fid){return MF.filter(mf=>mf.folderId===fid);}
function momsOfMF(mfid){return M.filter(m=>m.momFolderId===mfid);}
function momsUngrp(fid){return M.filter(m=>m.folderId===fid&&!m.momFolderId);}
function ifl(id){var f=gf(id);return f&&f.pw&&!UF.has(id);}
