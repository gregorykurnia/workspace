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
