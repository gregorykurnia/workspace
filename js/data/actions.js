// Data layer: every Firestore write. Each write returns its promise; failures are still logged.
// No DOM.
function _w(p){p.catch(console.error);return p;}
function _all(ps){var p=Promise.all(ps);p.catch(function(){});return p;}
function sF(f){return _w(db.collection('folders').doc(f.id).set(f));}
function sM(m){return _w(db.collection('moms').doc(m.id).set(m));}
function sD(d){return _w(db.collection('docs').doc(d.id).set(d));}
function sDF(df){return _w(db.collection('docfolders').doc(df.id).set(df));}
function sMF(mf){return _w(db.collection('momfolders').doc(mf.id).set(mf));}
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
function restoreItem(col,id){return _w(db.collection(col).doc(id).update({deleted:false,deletedAt:firebase.firestore.FieldValue.delete()}));}
function permDeleteItem(col,id){return _permDel(col,id);}
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
  if('content' in f||'title' in f||'date' in f||'tags' in f||'gdoc' in f){f.edited=Date.now();var who=_author();if(who)f.editedBy=who;}
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

// Move MoMs ('m'), files ('f') and areas ('a') in one all-or-nothing write. keys: ['m:id', ...].
// dest: { area, group } (area null = top level, areas only; group is a grouping of that area).
// Returns { ok, done, undo }: ok is false when nothing could be moved (an area into itself, or a
// missing item); done resolves when written; undo() writes every old place back.
function moveItems(keys,dest){
  var FV=firebase.firestore.FieldValue,batch=db.batch(),back=[];
  var destChain=dest.area?areaChain(dest.area).map(function(a){return a.id;}):[];
  for(var i=0;i<keys.length;i++){
    var t=keys[i].charAt(0),id=keys[i].slice(2),col,cur,now={},old={};
    if(t==='a'){
      cur=gf(id);if(!cur)continue;col='folders';
      if(dest.area&&(dest.area===id||destChain.indexOf(id)>-1))return{ok:false,done:Promise.reject(new Error('cycle')),undo:function(){return Promise.resolve();}};
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
    batch.update(db.collection(col).doc(id),now);back.push([col,id,old]);
  }
  if(!back.length)return{ok:false,done:Promise.resolve(),undo:function(){return Promise.resolve();}};
  return{
    ok:true,
    done:_w(batch.commit()),
    undo:function(){var b=db.batch();back.forEach(function(x){b.update(db.collection(x[0]).doc(x[1]),x[2]);});return _w(b.commit());}
  };
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
// Groupings: which collection a grouping lives in, by its kind.
function groupCol(kind){return kind==='mom'?'momfolders':'docfolders';}
function renameGroup(kind,id,name){return _w(db.collection(groupCol(kind)).doc(id).update({name:name}));}
// Remove a grouping: its MoMs or files stay in the area (their grouping field is cleared), and the
// grouping goes to Deleted. Returns { done, undo }. undo() puts the grouping and its items back.
function removeGroup(kind,id){
  var FV=firebase.firestore.FieldValue,b=db.batch(),moved=[],items=kind==='mom'?M:D,field=kind==='mom'?'momFolderId':'docFolderId',col=kind==='mom'?'moms':'docs';
  items.forEach(function(x){if(x[field]===id){moved.push(x.id);b.update(db.collection(col).doc(x.id),{[field]:FV.delete()});}});
  b.update(db.collection(groupCol(kind)).doc(id),{deleted:true,deletedAt:Date.now()});
  return{
    done:_w(b.commit()),
    undo:function(){
      var u=db.batch();
      u.update(db.collection(groupCol(kind)).doc(id),{deleted:false,deletedAt:FV.delete()});
      moved.forEach(function(mid){var o={};o[field]=id;u.update(db.collection(col).doc(mid),o);});
      return _w(u.commit());
    },
  };
}

// Rename an area (name and emoji) or a file. Writes only the fields given.
function renameArea(id,name,icon){return _w(db.collection('folders').doc(id).update({name:name,icon:icon||''}));}
function renameFile(id,name){return _w(db.collection('docs').doc(id).update({name:name}));}
