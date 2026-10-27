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
  if(key==='m')_pendingMoms(snap);
  _fromCache[key]=!!meta.fromCache;
  if(!meta.fromCache)_fromServer[key]=true;
  if(!LOADED[key]||snap.docChanges().length){
    var later=LOADED[key];
    set(snap.docs.map(d=>d.data()));
    LOADED[key]=true;
    chkLoad();
    Store._emit(col);
    if(later&&(key==='m'||key==='d'))_added(col,snap);
  }else chkLoad();
  _syncUpdate();
}
// MoMs with edits kept on this device that the server hasn't confirmed yet (for example, written
// offline before the page was reloaded). Emits 'pending' when the set changes.
Store.pendingMoms=new Set();
function _pendingMoms(snap){
  var now=new Set();snap.docs.forEach(function(d){if(d.metadata&&d.metadata.hasPendingWrites)now.add(d.id);});
  var same=now.size===Store.pendingMoms.size;now.forEach(function(id){if(!Store.pendingMoms.has(id))same=false;});
  if(!same){Store.pendingMoms=now;Store._emit('pending');}
}
// New MoMs and files that arrived after the first load and aren't this device's own unsent writes
// (S1). Emits 'added' with { col, items }; the screens decide whose they are and what to say.
function _added(col,snap){
  if(snap.restart)return;   // a visitor who signed in: what the new queries bring was already there, not just added
  var items=snap.docChanges().filter(function(c){return c.type==='added'&&c.doc&&!(c.doc.metadata&&c.doc.metadata.hasPendingWrites);})
    .map(function(c){return c.doc.data();}).filter(function(x){return x&&!x.deleted;});
  if(items.length)Store._emit('added',{col:col,items:items});
}
// Each collection is read by visibility (spec §E), the only list reads the rules allow: privateTo == null for
// everyone, plus privateTo == uid for a signed-in non-visitor. The queries' latest snapshots are merged by id into
// one snapshot for _onSnap, with docChanges() relative to the merged list it saw last. An item made private or
// visible leaves one query and joins the other in two snapshots raised together, so merging waits a tick: the
// item is dropped (or reported as new) only when neither query has it (or had it).
var _COLS=[
  ['folders','f',all=>{F=all.filter(f=>!f.deleted);TF=all.filter(f=>f.deleted);}],
  ['moms','m',all=>{M=all.filter(m=>!m.deleted);TM=all.filter(m=>m.deleted);}],
  ['docs','d',all=>{D=all.filter(d=>!d.deleted);TD=all.filter(d=>d.deleted);}],
  ['docfolders','df',all=>{DF=all.filter(df=>!df.deleted);TDF=all.filter(df=>df.deleted);}],
  ['momfolders','mf',all=>{MF=all.filter(mf=>!mf.deleted);TMF=all.filter(mf=>mf.deleted);}]
];
var _listenersStarted=false,_listenKey=null,_listenGen=0,_unsubs=[];
var _merged={};   // per collection key: Map id -> document, the merged list _onSnap saw last
function _listen(col,key,set,vals,gen,opt,err){
  var snaps=vals.map(()=>null),ids=new Set(),last=0,timer=null;
  var prev=_merged[key]||new Map(),all=prev.size>0;   // after a restart, compare everything with the old list
  function run(){
    timer=null;if(gen!==_listenGen)return;
    var cur=new Map();
    snaps.forEach((s,i)=>{if(i!==last)s.docs.forEach(d=>cur.set(d.id,d));});
    snaps[last].docs.forEach(d=>cur.set(d.id,d));   // in both for a moment: the latest snapshot's copy wins
    var restart=all;
    if(all){all=false;prev.forEach((d,id)=>ids.add(id));cur.forEach((d,id)=>ids.add(id));}
    var changes=[];
    ids.forEach(id=>{var was=prev.has(id),is=cur.has(id);
      if(was||is)changes.push({type:!was?'added':!is?'removed':'modified',doc:is?cur.get(id):prev.get(id)});});
    ids.clear();prev=_merged[key]=cur;
    var docs=Array.from(cur.values()).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    _onSnap(col,key,set,{metadata:{fromCache:snaps.some(s=>!!(s.metadata&&s.metadata.fromCache))},docs:docs,docChanges:()=>changes,restart:restart});
  }
  vals.forEach(function(v,i){
    _unsubs.push(db.collection(col).where('privateTo','==',v).onSnapshot(opt,function(snap){
      if(gen!==_listenGen)return;
      snaps[i]=snap;last=i;snap.docChanges().forEach(c=>ids.add(c.doc.id));
      if(!timer&&snaps.every(Boolean))timer=setTimeout(run,0);
    },err));
  });
}
// Starts the listeners for the signed-in user (core.js calls this on every sign-in). A different person on the
// same page (a visitor who signs in) restarts them with that person's queries.
function startListeners(){
  var u=auth.currentUser,key=u&&!u.isAnonymous?u.uid:'';
  if(_listenersStarted&&key===_listenKey)return;
  _unsubs.forEach(f=>f());_unsubs=[];
  _listenersStarted=true;_listenKey=key;var gen=++_listenGen;
  var opt={includeMetadataChanges:true},err=e=>Store._emit('error',e);
  _COLS.forEach(c=>_listen(c[0],c[1],c[2],key?[null,key]:[null],gen,opt,err));
}
// Live updates for one MoM (the open editor). Returns the unsubscribe function.
function watchMom(id,fn){return db.collection('moms').doc(id).onSnapshot(fn);}

function docAddedValue(d){var v=d&&d.added;if(!v)return 0;if(typeof v==='number')return v;if(v&&typeof v.toMillis==='function')return v.toMillis();var n=new Date(v).getTime();return Number.isNaN(n)?0:n;}
function gf(id){return F.find(f=>f.id===id);}
// privateTo of an area (the uid of the admin it is private to), or null: public, unknown, or no area.
function privOf(areaId){var a=areaId?gf(areaId):null;return a&&a.privateTo?a.privateTo:null;}
// What the private-area screens offer (spec §F, §G). Pure reads, so the unit tests can run them.
// Privacy is only real once the listeners filter by privateTo (plan 2.1) and the rules are deployed (plan O5).
// Until then the live site doesn't offer "Make private": it would promise what nothing enforces. The emulator
// runs the rules, so it does. Step O5 sets PRIVATE_LIVE to true.
var PRIVATE_LIVE=false;
function privateOffered(){return PRIVATE_LIVE||(typeof EMULATOR!=='undefined'&&EMULATOR);}
// The ⋯ menu entry of an area: 'make' (Make private) or 'release' (Make visible to the team), or null.
// Only an admin gets one, and never inside a private area (its parent's value decides) or on an area
// that is private to someone else.
function privateAction(areaId){
  var u=sessionUser(),a=gf(areaId);
  if(!privateOffered()||!a||!u||u.isAnonymous||CURR_USER_ROLE!=='admin'||privOf(a.parent))return null;
  var pv=privOf(areaId);
  return!pv?'make':pv===u.uid?'release':null;
}
// Is this area ('a'), MoM ('m') or file ('f') private, in its own right or by being inside a private area?
// Share a link and Access are off for these.
function isPrivate(kind,it){
  if(!it)return false;
  return kind==='a'?!!privOf(it.id):!!it.privateTo||!!privOf(it.folderId);
}
function kids(pid){return F.filter(f=>f.parent===pid).sort((a,b)=>(a.name||'').localeCompare((b.name||''),undefined,{sensitivity:'base'}));}
function momsOf(fid){return M.filter(m=>m.folderId===fid);}
function docsOf(fid){return D.filter(d=>d.folderId===fid);}
function docsOfDF(dfid){return D.filter(d=>d.docFolderId===dfid);}
function docFoldersOf(fid){return DF.filter(df=>df.folderId===fid);}
function momFoldersOf(fid){return MF.filter(mf=>mf.folderId===fid);}
function momsOfMF(mfid){return M.filter(m=>m.momFolderId===mfid);}

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

// ---------- Share links (guest views, plan 2.8 P5): the item's own link wins ----------
// `shared` is three-state: true = link on, false = link turned off, missing = follows its area.
// The area whose link opens `areaId`: walking up from the area, the first explicit value decides
// (false = closed, which also closes everything under it; true = that area is the share root).
// Null when no link opens it.
function shareRootOf(areaId){
  var chain=areaChain(areaId);
  for(var i=chain.length-1;i>=0;i--){
    if(chain[i].shared===false)return null;
    if(chain[i].shared===true)return chain[i];
  }
  return null;
}
function visitorCanArea(areaId){return!!shareRootOf(areaId);}
function _visitorCanItem(it){
  if(!it)return false;
  if(it.shared===true)return true;
  if(it.shared===false)return false;
  return visitorCanArea(it.folderId);
}
function visitorCanMom(m){return _visitorCanItem(m);}
function visitorCanFile(f){return _visitorCanItem(f);}
// Restrictions for a guest: the share root's own password and any restricted area below it apply;
// areas above the root don't (the owner chose to share from there). An item with its own link on
// skips the areas' passwords altogether (its own password, for a file, still applies).
function visitorLockedArea(areaId){
  var root=shareRootOf(areaId);if(!root)return null;
  var c=areaChain(areaId),i=c.findIndex(function(a){return a.id===root.id;});
  for(var j=Math.max(i,0);j<c.length;j++)if(c[j].pw&&!UF.has(c[j].id))return c[j];
  return null;
}
// What stands between a guest and this item: {area} (a restricted area to open first), {file}
// (the file's own password), or null.
function visitorGate(kind,item){
  if(item.shared!==true){var la=visitorLockedArea(item.folderId);if(la)return{area:la};}
  if(kind==='f'&&item.pw&&!UD.has(item.id))return{file:true};
  return null;
}
