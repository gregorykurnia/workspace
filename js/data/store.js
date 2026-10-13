// Data layer: live collections, load state, change events and read-only queries. No DOM.
var F=[],M=[],D=[],DF=[],MF=[],UF=new Set(),UD=new Set(),LOADED={f:false,m:false,d:false,df:false,mf:false};
var TF=[],TM=[],TD=[],TDF=[],TMF=[];

// Change events. fn(what, err) where what is a collection name ('folders', 'moms', 'docs',
// 'docfolders', 'momfolders'), 'loaded' (once, when all five have arrived), 'sync' (Store.sync
// changed), 'error' (a listener failed), or a session event from session.js ('guest', 'role',
// 'access', 'users').
// Store.sync: 'ok' (up to date) | 'catchup' (showing data the server hasn't confirmed yet) |
// 'offline' (the browser reports no connection).
var Store={
  _fns:[],
  sync:navigator.onLine===false?'offline':'ok',
  visitRoot:null,   // the shared area a visitor arrived on (set by the visitor pages)
  onChange:function(fn){Store._fns.push(fn);},
  _emit:function(what,err){Store._fns.slice().forEach(function(fn){fn(what,err);});}
};
var _allLoaded=function(){return LOADED.f&&LOADED.m&&LOADED.d&&LOADED.df&&LOADED.mf;};

// 'loaded' fires on the first copy of all five collections, which may come from this device's
// offline copy. The automatic purge of week-old deleted items waits for the server's copy of all
// five: a cached Deleted list can be stale (a colleague may have restored something since).
var _chkLoadDone=false,_purged=false,_fromServer={},_fromCache={};
function chkLoad(){
  if(!_chkLoadDone&&_allLoaded()){_chkLoadDone=true;Store._emit('loaded');}
  if(!_purged&&_fromServer.f&&_fromServer.m&&_fromServer.d&&_fromServer.df&&_fromServer.mf){_purged=true;_autopurge();}
}

function _syncNow(){
  if(navigator.onLine===false)return'offline';
  if(!_listenersStarted||!_allLoaded())return'ok';   // the loading skeleton covers this time
  for(var k in _fromCache)if(_fromCache[k])return'catchup';
  return'ok';
}
function _syncUpdate(){var s=_syncNow();if(s!==Store.sync){Store.sync=s;Store._emit('sync');}}
window.addEventListener('online',_syncUpdate);
window.addEventListener('offline',_syncUpdate);

// One snapshot of one collection. Listeners ask for metadata changes (to know when data is
// confirmed by the server), but a metadata-only snapshot never replaces the data or emits the
// collection event, so the old page sees exactly the events it saw before.
function _onSnap(col,key,set,snap){
  var meta=snap.metadata||{};
  _fromCache[key]=!!meta.fromCache;
  if(!meta.fromCache)_fromServer[key]=true;
  if(!LOADED[key]||snap.docChanges().length){
    set(snap.docs.map(d=>d.data()));
    LOADED[key]=true;
    chkLoad();
    Store._emit(col);
  }else chkLoad();
  _syncUpdate();
}
var _listenersStarted=false;
function startListeners(){
  if(_listenersStarted)return;_listenersStarted=true;
  var opt={includeMetadataChanges:true},err=e=>Store._emit('error',e);
  db.collection('folders').onSnapshot(opt,snap=>_onSnap('folders','f',all=>{F=all.filter(f=>!f.deleted);TF=all.filter(f=>f.deleted);},snap),err);
  db.collection('moms').onSnapshot(opt,snap=>_onSnap('moms','m',all=>{M=all.filter(m=>!m.deleted);TM=all.filter(m=>m.deleted);},snap),err);
  db.collection('docs').onSnapshot(opt,snap=>_onSnap('docs','d',all=>{D=all.filter(d=>!d.deleted);TD=all.filter(d=>d.deleted);},snap),err);
  db.collection('docfolders').onSnapshot(opt,snap=>_onSnap('docfolders','df',all=>{DF=all.filter(df=>!df.deleted);TDF=all.filter(df=>df.deleted);},snap),err);
  db.collection('momfolders').onSnapshot(opt,snap=>_onSnap('momfolders','mf',all=>{MF=all.filter(mf=>!mf.deleted);TMF=all.filter(mf=>mf.deleted);},snap),err);
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

// ---------- Who may see what (the new UI; the old page keeps canSeeFolder in session.js) ----------
// The signed-in person (null when signed out). A function so it is read at call time.
function sessionUser(){return typeof auth!=='undefined'&&auth?auth.currentUser:null;}
// An area and its ancestors, top level first. Stops on a broken or circular parent chain.
function areaChain(id){var out=[],seen=new Set(),c=gf(id);while(c&&!seen.has(c.id)){seen.add(c.id);out.unshift(c);c=c.parent?gf(c.parent):null;}return out;}
function _granted(a,u){return FA.some(fa=>fa.folderId===a.id&&fa.uid===u.uid);}
// Visitors (anonymous, from a shared link) see the area they arrived on, if its link is on, and
// what is inside it, except a sub-area whose own link was turned off (shared === false).
function _visitorChain(areaId){
  var root=Store.visitRoot;if(!root)return null;
  var chain=areaChain(areaId),i=chain.findIndex(a=>a.id===root);
  if(i<0||chain[i].shared!==true)return null;
  for(var j=i+1;j<chain.length;j++)if(chain[j].shared===false)return null;
  return chain.slice(i);
}
// Can the current viewer see this area at all: admins every area, members the areas granted to
// them and everything inside, visitors their shared area. Nobody sees a missing or deleted area.
function canSee(areaId){
  if(!gf(areaId))return false;
  var u=sessionUser();if(!u)return false;
  if(u.isAnonymous)return!!_visitorChain(areaId);
  if(CURR_USER_ROLE==='admin')return true;
  return areaChain(areaId).some(a=>_granted(a,u));
}
// The restricted area (this one or the highest one above it) that isn't opened this session.
function lockedArea(areaId){var c=areaChain(areaId);for(var i=0;i<c.length;i++)if(c[i].pw&&!UF.has(c[i].id))return c[i];return null;}
// A file is locked if it has its own password not entered this session, or sits in a locked area.
function lockedFile(f){if(!f)return false;if(f.pw&&!UD.has(f.id))return true;return!!lockedArea(f.folderId);}
// Items left out of lists, Flagged, Recent and search: outside what the viewer can see, inside a
// locked area, a locked file, or (for visitors) an item whose own link was turned off.
// kind: 'm' (MoM) or 'f' (file).
function hiddenItem(kind,item){
  if(!item||!canSee(item.folderId))return true;
  var u=sessionUser();
  if(u&&u.isAnonymous&&item.shared===false)return true;
  return kind==='m'?!!lockedArea(item.folderId):lockedFile(item);
}
function visibleAreas(){return F.filter(a=>canSee(a.id));}
// The path shown in crumbs, and how far Esc climbs: admins from the top, members from their
// highest granted area, visitors from their shared area. Empty when the area isn't visible.
function crumbPath(areaId){
  if(!canSee(areaId))return[];
  var u=sessionUser(),chain=areaChain(areaId);
  if(u.isAnonymous)return _visitorChain(areaId)||[];
  if(CURR_USER_ROLE==='admin')return chain;
  var i=chain.findIndex(a=>_granted(a,u));
  return i>-1?chain.slice(i):[];
}
