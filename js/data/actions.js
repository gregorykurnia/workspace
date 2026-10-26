// Data layer: every Firestore write. Each write returns its promise; failures are still logged.
// No DOM.
function _w(p){p.catch(console.error);return p;}
function _all(ps){var p=Promise.all(ps);p.catch(function(){});return p;}
// Every create copies its area's privateTo (null at the top level). Only fills it in when the caller left it out.
function _priv(o,areaId){if(o.privateTo===undefined)o.privateTo=privOf(areaId);return o;}
function sF(f){return _w(db.collection('folders').doc(f.id).set(_priv(f,f.parent)));}
function sM(m){return _w(db.collection('moms').doc(m.id).set(_priv(m,m.folderId)));}
function sD(d){return _w(db.collection('docs').doc(d.id).set(_priv(d,d.folderId)));}
function sDF(df){return _w(db.collection('docfolders').doc(df.id).set(_priv(df,df.folderId)));}
function sMF(mf){return _w(db.collection('momfolders').doc(mf.id).set(_priv(mf,mf.folderId)));}
var _WEEK=7*24*60*60*1000;
function _softDel(col,id){return _w(db.collection(col).doc(id).update({deleted:true,deletedAt:Date.now()}));}
function _permDel(col,id){return _w(db.collection(col).doc(id).delete());}
function dF(id){return _softDel('folders',id);}
function dM(id){return _softDel('moms',id);}
function dD(id){return _softDel('docs',id);}
function dDF(id){return _softDel('docfolders',id);}
function dMF(id){return _softDel('momfolders',id);}
function dFDeep(fid){
  var ps=[];
  kids(fid).forEach(c=>ps.push(dFDeep(c.id)));
  momsOf(fid).forEach(m=>ps.push(dM(m.id)));
  docsOf(fid).forEach(d=>ps.push(dD(d.id)));
  DF.filter(df=>df.folderId===fid).forEach(df=>{docsOfDF(df.id).forEach(d=>ps.push(dD(d.id)));ps.push(dDF(df.id));});
  MF.filter(mf=>mf.folderId===fid).forEach(mf=>{momsOfMF(mf.id).forEach(m=>ps.push(dM(m.id)));ps.push(dMF(mf.id));});
  ps.push(dF(fid));
  return _all(ps);
}
function clearTrash(){
  var ps=[];
  TF.forEach(f=>ps.push(_permDel('folders',f.id)));
  TM.forEach(m=>ps.push(_permDel('moms',m.id)));
  TD.forEach(d=>ps.push(_permDel('docs',d.id)));
  TDF.forEach(df=>ps.push(_permDel('docfolders',df.id)));
  TMF.forEach(mf=>ps.push(_permDel('momfolders',mf.id)));
  return _all(ps);
}
function _autopurge(){
  var cut=Date.now()-_WEEK,ps=[];
  TF.filter(f=>f.deletedAt<cut).forEach(f=>ps.push(_permDel('folders',f.id)));
  TM.filter(m=>m.deletedAt<cut).forEach(m=>ps.push(_permDel('moms',m.id)));
  TD.filter(d=>d.deletedAt<cut).forEach(d=>ps.push(_permDel('docs',d.id)));
  TDF.filter(df=>df.deletedAt<cut).forEach(df=>ps.push(_permDel('docfolders',df.id)));
  TMF.filter(mf=>mf.deletedAt<cut).forEach(mf=>ps.push(_permDel('momfolders',mf.id)));
  return _all(ps);
}
// Folder access (admin): grant one user access to one folder, or revoke a grant by its id.
function grantAccess(fa){return _w(db.collection('folder_access').doc(fa.id).set(fa));}
function revokeAccess(id){return _w(db.collection('folder_access').doc(id).delete());}
async function hw(pw){var b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(pw));return Array.from(new Uint8Array(b)).map(v=>v.toString(16).padStart(2,'0')).join('');}

// ---------- New UI (Phase 4) ----------
// A new document id, in the same shape as the old app's ids ('_' + base-36).
function newId(){var a=new Uint32Array(2);crypto.getRandomValues(a);return'_'+a[0].toString(36)+a[1].toString(36);}
// Who is writing, for createdBy / editedBy (plan 2.8). Null when nobody is signed in.
function _author(){var u=sessionUser();return u&&!u.isAnonymous?{uid:u.uid,name:u.displayName||u.email||''}:null;}
// A new MoM. Same fields as the old app, plus created and createdBy.
function createMom(fields){
  var m=Object.assign({id:newId(),title:'',date:Date.now(),content:'',tags:[],starred:false,created:Date.now()},fields);
  var who=_author();if(who)m.createdBy=who;
  return{id:m.id,done:sM(m)};
}
// Change some fields of a MoM without rewriting the others (a colleague's change to another field
// survives). Every content save also records editedBy and edited.
function updateMom(id,fields){
  var f=Object.assign({},fields);
  // edited (ms) names this version; prevEdited (written by the new editor) names the version it was
  // based on, so another open copy can merge the two (js/data/merge.js).
  if('content' in f||'title' in f||'date' in f||'tags' in f||'gdoc' in f){f.edited=f.edited||Date.now();var who=_author();if(who)f.editedBy=who;}
  return _w(db.collection('moms').doc(id).update(f));
}
// Flag / unflag a MoM ('m') or file ('f').
function setFlag(kind,id,on){return _w(db.collection(kind==='m'?'moms':'docs').doc(id).update({starred:!!on}));}
// Final (the data keeps its old name, readOnly).
function setFinal(kind,id,on){return _w(db.collection(kind==='m'?'moms':'docs').doc(id).update({readOnly:!!on}));}
// One-off content conversion (the prospect journal). Writes only if the stored content is still
// what was converted, and keeps the original once in contentBackup. Needs a connection.
function convertMomContent(id,original,converted){
  var ref=db.collection('moms').doc(id);
  return db.runTransaction(function(t){
    return t.get(ref).then(function(doc){
      if(!doc.exists)return false;
      var d=doc.data();
      if(d.content!==original)return false;
      var f={content:converted};
      if(d.contentBackup==null)f.contentBackup=original;
      t.update(ref,f);
      return true;
    });
  });
}

// ---------- Private areas (spec §F) ----------
// Everything inside an area, deleted items too, as [collection, item] pairs (not the area itself).
// Sub-areas whose id is in `stop` are left out with everything inside them.
var _ITEM_COLS=[['moms',function(){return M.concat(TM);}],['docs',function(){return D.concat(TD);}],
  ['docfolders',function(){return DF.concat(TDF);}],['momfolders',function(){return MF.concat(TMF);}]];
function _subtree(areaId,stop){
  var all=F.concat(TF),ids=new Set([areaId]),out=[],grew=true;
  while(grew){grew=false;all.forEach(function(a){if(a.parent&&ids.has(a.parent)&&!ids.has(a.id)&&!(stop&&stop.has('a:'+a.id))){ids.add(a.id);out.push(['folders',a]);grew=true;}});}
  _ITEM_COLS.forEach(function(c){
    var k=c[0]==='moms'?'m:':c[0]==='docs'?'f:':'';
    c[1]().forEach(function(x){if(ids.has(x.folderId)&&!(k&&stop&&stop.has(k+x.id)))out.push([c[0],x]);});
  });
  return out;
}
function _pv(x){return x&&x.privateTo?x.privateTo:null;}
// Write a list of { col, id, data, root } updates in batches of 400 (Firestore takes 500 at most).
// One batch is all-or-nothing. When there are more, they are sent in an order that fails closed
// (the SDK applies one client's writes in order): roots turning public first, then everything
// inside, then roots turning private. A half-done write leaves items hidden, never exposed.
function _writeAll(ws){
  var rank=function(w){return!w.root?1:w.data.privateTo?2:0;};
  ws=ws.slice().sort(function(a,b){return rank(a)-rank(b);});
  var ps=[];
  for(var i=0;i<ws.length;i+=400){
    var b=db.batch();
    ws.slice(i,i+400).forEach(function(w){b.update(db.collection(w.col).doc(w.id),w.data);});
    ps.push(_w(b.commit()));
  }
  return _all(ps);
}
function _refused(why){var p=Promise.reject(new Error(why));p.catch(function(){});return p;}
// Make an area private to the signed-in admin (on) or visible to the team again (off). Writes
// privateTo on the area and everything inside it, deleted items too. Only for an admin, on an area
// whose parent isn't private, that is public or already the caller's (running it again finishes a
// half-done write). Making private also turns the area's share link off; making visible leaves it off.
// Returns { ok, reason, done }: reason is 'admin', 'missing', 'inside' (the parent is private) or
// 'owner' (someone else's) when ok is false; done resolves when every batch is written.
function setPrivate(areaId,on){
  var u=sessionUser(),a=gf(areaId),why=null;
  if(!u||u.isAnonymous||CURR_USER_ROLE!=='admin')why='admin';
  else if(!a)why='missing';
  else if(privOf(a.parent))why='inside';
  else if(_pv(a)&&_pv(a)!==u.uid)why='owner';
  if(why)return{ok:false,reason:why,done:_refused(why)};
  var v=on?u.uid:null,root={privateTo:v};
  if(on)root.shared=false;
  var ws=[{col:'folders',id:a.id,data:root,root:true}];
  _subtree(a.id).forEach(function(p){if(p[1].privateTo!==v)ws.push({col:p[0],id:p[1].id,data:{privateTo:v}});});
  return{ok:true,reason:null,done:_writeAll(ws)};
}

// The privateTo a moved MoM, file or area ends with: the destination's, except that an area private in
// its own right (its parent isn't) stays private when it lands somewhere public.
function _landsPrivate(t,cur,dest){
  var v=privOf(dest.area);
  return t==='a'&&!v&&_pv(cur)&&!privOf(cur.parent)?_pv(cur):v;
}
// The keys among `keys` that moving them to `dest` would make visible to the team (the move-out
// warning, spec §G): private now, public after. The same rule moveItems writes, and the same items
// it skips (a MoM or file can't go to the top level).
function moveExposes(keys,dest){
  return keys.filter(function(k){
    var t=k.charAt(0),id=k.slice(2),cur=t==='a'?gf(id):(t==='m'?M:D).find(function(x){return x.id===id;});
    if(!cur||(t!=='a'&&!dest.area))return false;
    return!!(_pv(cur)||privOf(t==='a'?cur.parent:cur.folderId))&&!_landsPrivate(t,cur,dest);
  });
}
// Move MoMs ('m'), files ('f') and areas ('a'). keys: ['m:id', ...].
// dest: { area, group } (area null = top level, areas only; group is a grouping of that area).
// Moved items take the destination's privateTo, and a moved area's contents (deleted ones too)
// follow it. Two exceptions keep things private: an area private in its own right (its parent
// isn't) stays private when moved somewhere public, and a public area's own private sub-areas
// stay private when it moves somewhere public. Up to 400 writes go in one all-or-nothing batch.
// Returns { ok, done, undo }: ok is false when nothing could be moved (an area into itself, or a
// missing item); done resolves when written; undo() writes every old place and privateTo back.
function moveItems(keys,dest){
  var FV=firebase.firestore.FieldValue,ws=[],back=[],stop=new Set(keys.filter(function(k){return k[0]==='a'||dest.area;}));
  var destChain=dest.area?areaChain(dest.area).map(function(a){return a.id;}):[];
  for(var i=0;i<keys.length;i++){
    var t=keys[i].charAt(0),id=keys[i].slice(2),col,cur,now={},old={},nv;
    if(t==='a'){
      cur=gf(id);if(!cur)continue;col='folders';
      if(dest.area&&(dest.area===id||destChain.indexOf(id)>-1))return{ok:false,done:_refused('cycle'),undo:function(){return Promise.resolve();}};
      now.parent=dest.area||FV.delete();
      old.parent='parent' in cur?cur.parent:FV.delete();
    }else if(t==='m'){
      cur=M.find(function(x){return x.id===id;});if(!cur||!dest.area)continue;col='moms';
      now.folderId=dest.area;now.momFolderId=dest.group||FV.delete();
      old.folderId=cur.folderId;old.momFolderId='momFolderId' in cur?cur.momFolderId:FV.delete();
    }else{
      cur=D.find(function(x){return x.id===id;});if(!cur||!dest.area)continue;col='docs';
      now.folderId=dest.area;now.docFolderId=dest.group||FV.delete();
      old.folderId=cur.folderId;old.docFolderId='docFolderId' in cur?cur.docFolderId:FV.delete();
    }
    nv=_landsPrivate(t,cur,dest);
    now.privateTo=nv;old.privateTo=_pv(cur);
    ws.push({col:col,id:id,data:now,root:true});back.push({col:col,id:id,data:old,root:true});
    // An area whose value changes takes its contents along (a public area moving somewhere
    // public keeps its private sub-areas as they are). Selected items inside are moved on their own.
    if(t==='a'&&nv!==_pv(cur))_subtree(id,stop).forEach(function(p){
      if(p[1].privateTo===nv)return;
      ws.push({col:p[0],id:p[1].id,data:{privateTo:nv}});back.push({col:p[0],id:p[1].id,data:{privateTo:_pv(p[1])}});
    });
  }
  if(!back.length)return{ok:false,done:Promise.resolve(),undo:function(){return Promise.resolve();}};
  return{ok:true,done:_writeAll(ws),undo:function(){return _writeAll(back);}};
}
// Remember that this person opened a MoM ('m') or file ('f'): newest first, 8 at most (F13).
// Visitors keep none. A refused write only logs: Recent is a convenience.
function touchRecent(kind,id){
  var u=sessionUser();if(!u||u.isAnonymous)return;
  if(CURR_USER_RECENT[0]&&CURR_USER_RECENT[0].k===kind&&CURR_USER_RECENT[0].id===id)return;
  CURR_USER_RECENT=[{k:kind,id:id,at:Date.now()}].concat(CURR_USER_RECENT.filter(function(x){return!(x.k===kind&&x.id===id);})).slice(0,8);
  _w(db.collection('users').doc(u.uid).set({recent:CURR_USER_RECENT},{merge:true}));
}

// Shared links (P5): the `shared` field is three-state. true = on, false = turned off, missing = follows its area.
function setShared(kind,id,on){
  var col=kind==='a'?'folders':kind==='m'?'moms':'docs';
  return _w(db.collection(col).doc(id).update({shared:!!on}));
}
// Restore or remove forever a list of [collection, id] pairs in one batch.
function restoreBatch(list){
  var b=db.batch();
  list.forEach(function(x){b.update(db.collection(x[0]).doc(x[1]),{deleted:false,deletedAt:firebase.firestore.FieldValue.delete()});});
  return _w(b.commit());
}
function purgeBatch(list){
  var b=db.batch();
  list.forEach(function(x){b.delete(db.collection(x[0]).doc(x[1]));});
  return _w(b.commit());
}
// Groupings: which collection a grouping lives in, by its kind ('mom', 'file' or 'both').
// A grouping that holds both lives in momfolders (holds: 'both'); its files point at it by docFolderId.
function groupCol(kind){return kind==='file'?'docfolders':'momfolders';}
function renameGroup(kind,id,name){return _w(db.collection(groupCol(kind)).doc(id).update({name:name}));}
// Remove a grouping: its MoMs and files stay in the area (their grouping field is cleared), and the
// grouping goes to Deleted. Returns { done, undo }. undo() puts the grouping and its items back.
function removeGroup(kind,id){
  var FV=firebase.firestore.FieldValue,b=db.batch(),moved=[];
  var parts=kind==='both'?[[M,'momFolderId','moms'],[D,'docFolderId','docs']]:kind==='mom'?[[M,'momFolderId','moms']]:[[D,'docFolderId','docs']];
  parts.forEach(function(p){p[0].forEach(function(x){if(x[p[1]]===id){moved.push([p[2],x.id,p[1]]);b.update(db.collection(p[2]).doc(x.id),{[p[1]]:FV.delete()});}});});
  b.update(db.collection(groupCol(kind)).doc(id),{deleted:true,deletedAt:Date.now()});
  return{
    done:_w(b.commit()),
    undo:function(){
      var u=db.batch();
      u.update(db.collection(groupCol(kind)).doc(id),{deleted:false,deletedAt:FV.delete()});
      moved.forEach(function(m){var o={};o[m[2]]=id;u.update(db.collection(m[0]).doc(m[1]),o);});
      return _w(u.commit());
    },
  };
}

// Rename an area (name and emoji) or a file. Writes only the fields given.
function renameArea(id,name,icon){return _w(db.collection('folders').doc(id).update({name:name,icon:icon||''}));}
function renameFile(id,name){return _w(db.collection('docs').doc(id).update({name:name}));}

// Restrict an area or a file with a password, or lift it. hash is the SHA-256 hex from hw(), or null to remove.
function setPassword(kind,id,hash){
  var col=kind==='a'?'folders':'docs';
  return _w(db.collection(col).doc(id).update({pw:hash?hash:firebase.firestore.FieldValue.delete()}));
}
