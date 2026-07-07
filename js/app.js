const FB={apiKey:"AIzaSyA0ZOM95oAxG0X8JC26yX9V2S9PcSCOI0Y",authDomain:"greg-project-5b838.firebaseapp.com",projectId:"greg-project-5b838",storageBucket:"greg-project-5b838.firebasestorage.app",messagingSenderId:"695512510143",appId:"1:695512510143:web:ceed96aacd618115ba600a"};
const CL_CLOUD='dgznvawnm',CL_PRESET='workspace_uploads';
firebase.initializeApp(FB);
const db=firebase.firestore();
var F=[],M=[],D=[],DF=[],MF=[],PATH=[],VIEW='home',TAB='sub',EMOM=null,DOC_FOLDER=null,MOM_FOLDER=null,EXP=new Set(),UF=new Set(),UD=new Set(),LOADED={f:false,m:false,d:false,df:false,mf:false},_editor=null;
var FA=[],CURR_USER_ROLE='member',WORKSPACE_USERS=[];
function setSS(s){var dot=document.getElementById('sdot'),lbl=document.getElementById('slbl');if(s==='live'){dot.className='sync-dot live';lbl.textContent='Live';}else if(s==='err'){dot.className='sync-dot err';lbl.textContent='Offline';}else{dot.className='sync-dot';lbl.textContent='Connecting...';}}
function chkLoad(){if(LOADED.f&&LOADED.m&&LOADED.d&&LOADED.df&&LOADED.mf){setSS('live');if(window.location.hash&&window.location.hash!=='#')applyHash();render();}}
function buildHash(){
  if(VIEW==='mom'&&EMOM)return'#m='+encodeURIComponent(EMOM.id);
  if(VIEW==='folder'&&PATH.length){var h='#f='+encodeURIComponent(PATH[PATH.length-1])+'&t='+TAB;if(DOC_FOLDER)h+='&df='+encodeURIComponent(DOC_FOLDER);if(MOM_FOLDER)h+='&mf='+encodeURIComponent(MOM_FOLDER);return h;}
  return'#';
}
function applyHash(){
  var raw=window.location.hash;
  if(!raw||raw==='#'){VIEW='home';PATH=[];EMOM=null;DOC_FOLDER=null;MOM_FOLDER=null;destroyEditor();return;}
  var p={};raw.slice(1).split('&').forEach(s=>{var i=s.indexOf('=');if(i>0)p[s.slice(0,i)]=decodeURIComponent(s.slice(i+1));});
  if(p.m){var m=M.find(v=>v.id===p.m);if(m){EMOM=m;VIEW='mom';PATH=pathTo(m.folderId);PATH.forEach(id=>EXP.add(id));saveExp();destroyEditor();return;}}
  if(p.f){if(!gf(p.f)){VIEW='home';PATH=[];return;}PATH=pathTo(p.f);VIEW='folder';TAB=p.t||'sub';DOC_FOLDER=p.df||null;MOM_FOLDER=p.mf||null;EMOM=null;destroyEditor();PATH.forEach(id=>EXP.add(id));saveExp();return;}
  VIEW='home';PATH=[];EMOM=null;DOC_FOLDER=null;MOM_FOLDER=null;destroyEditor();
}
window.addEventListener('hashchange',()=>{applyHash();render();});
function sF(f){db.collection('folders').doc(f.id).set(f).catch(console.error);}
function sM(m){db.collection('moms').doc(m.id).set(m).catch(console.error);}
function sD(d){db.collection('docs').doc(d.id).set(d).catch(console.error);}
function dF(id){db.collection('folders').doc(id).delete().catch(console.error);}
function dM(id){db.collection('moms').doc(id).delete().catch(console.error);}
function dD(id){db.collection('docs').doc(id).delete().catch(console.error);}
function dFDeep(fid){kids(fid).forEach(c=>dFDeep(c.id));momsOf(fid).forEach(m=>dM(m.id));docsOf(fid).forEach(d=>dD(d.id));dF(fid);}
db.collection('folders').onSnapshot(snap=>{F=snap.docs.map(d=>d.data());LOADED.f=true;chkLoad();if(LOADED.m&&LOADED.d)render();},e=>{setSS('err');console.error(e);});
db.collection('moms').onSnapshot(snap=>{var eid=EMOM?EMOM.id:null;M=snap.docs.map(d=>d.data());if(eid)EMOM=M.find(m=>m.id===eid)||EMOM;LOADED.m=true;chkLoad();if(LOADED.f&&LOADED.d)render();},e=>{setSS('err');console.error(e);});
db.collection('docs').onSnapshot(snap=>{D=snap.docs.map(d=>d.data());LOADED.d=true;chkLoad();if(LOADED.f&&LOADED.m&&LOADED.df)render();},e=>{setSS('err');console.error(e);});
db.collection('docfolders').onSnapshot(snap=>{DF=snap.docs.map(d=>d.data());LOADED.df=true;chkLoad();if(LOADED.f&&LOADED.m&&LOADED.d&&LOADED.mf)render();},e=>{setSS('err');console.error(e);});
db.collection('momfolders').onSnapshot(snap=>{MF=snap.docs.map(d=>d.data());LOADED.mf=true;chkLoad();if(LOADED.f&&LOADED.m&&LOADED.d&&LOADED.df)render();},e=>{setSS('err');console.error(e);});
function sDF(df){db.collection('docfolders').doc(df.id).set(df).catch(console.error);}
function dDF(id){db.collection('docfolders').doc(id).delete().catch(console.error);}
function sMF(mf){db.collection('momfolders').doc(mf.id).set(mf).catch(console.error);}
function dMF(id){db.collection('momfolders').doc(id).delete().catch(console.error);}
function docFoldersOf(fid){return DF.filter(df=>df.folderId===fid);}
function docsOfDF(dfid){return D.filter(d=>d.docFolderId===dfid);}
function docsUngrp(fid){return D.filter(d=>d.folderId===fid&&!d.docFolderId);}
function momFoldersOf(fid){return MF.filter(mf=>mf.folderId===fid);}
function momsOfMF(mfid){return M.filter(m=>m.momFolderId===mfid);}
function momsUngrp(fid){return M.filter(m=>m.folderId===fid&&!m.momFolderId);}
async function uploadCL(file,onProg){
  return new Promise((res,rej)=>{
    var fd=new FormData();fd.append('file',file);fd.append('upload_preset',CL_PRESET);
    var rt;
    if(/^image\//i.test(file.type)||/\.(png|jpg|jpeg|gif|webp|bmp|svg|tiff|ico)$/i.test(file.name)){rt='image';}
    else if(/^video\//i.test(file.type)||/\.(mp4|mov|avi|mkv|webm)$/i.test(file.name)){rt='video';}
    else{rt='raw';}
    var xhr=new XMLHttpRequest();
    xhr.open('POST','https://api.cloudinary.com/v1_1/'+CL_CLOUD+'/'+rt+'/upload');
    xhr.upload.onprogress=e=>{if(e.lengthComputable&&onProg)onProg(Math.round(e.loaded/e.total*100));};
    xhr.onload=()=>{
      if(xhr.status===200){var r=JSON.parse(xhr.responseText);res({url:r.secure_url,name:file.name,cloudType:r.resource_type,format:r.format||file.name.split('.').pop().toLowerCase()});}
      else{
        var msg='Upload failed ('+xhr.status+')';
        try{var er=JSON.parse(xhr.responseText);msg=er.error&&er.error.message?er.error.message:msg;}catch(e){}
        if(xhr.status===400&&msg.toLowerCase().includes('format')){msg='This file format is not allowed in your Cloudinary preset. Go to Cloudinary → Settings → Upload → upload preset → Allowed formats, and add the format.';}
        else if(xhr.status===401){msg='Cloudinary auth error. Check your upload preset is set to Unsigned.';}
        rej(new Error(msg));
      }
    };
    xhr.onerror=()=>rej(new Error('Network error'));xhr.send(fd);
  });
}
function uid(){return '_'+Math.random().toString(36).slice(2,10);}
function destroyEditor(){if(_editor){try{_editor.destroy();}catch(e){}_editor=null;}}
function esc(s){if(s==null)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function fmtDate(ts){if(!ts)return'';return new Date(ts).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});}
function gf(id){return F.find(f=>f.id===id);}
function kids(pid){return F.filter(f=>f.parent===pid);}
function momsOf(fid){return M.filter(m=>m.folderId===fid);}
function docsOf(fid){return D.filter(d=>d.folderId===fid);}
function cf(){return PATH.length?gf(PATH[PATH.length-1]):null;}
function pathTo(id){var p=[],c=gf(id);while(c){p.unshift(c.id);c=c.parent?gf(c.parent):null;}return p;}
function cnt(fid){return kids(fid).length+momsOf(fid).length+docsOf(fid).length;}
function saveExp(){localStorage.setItem('G_exp',JSON.stringify([...EXP]));}
function loadExp(){try{EXP=new Set(JSON.parse(localStorage.getItem('G_exp')||'[]'));}catch(e){}}
function folderLabel(id){var p=[],c=gf(id);while(c){p.unshift(c.name);c=c.parent?gf(c.parent):null;}return p.join(' / ');}
function docIco(d){if(d.format==='pdf'||d.type==='pdf')return'&#128196;';if(d.cloudType==='image')return'&#128444;';if(d.cloudType==='video')return'&#127916;';var m={pdf:'&#128196;',presentation:'&#128202;',spreadsheet:'&#128203;',image:'&#128444;',link:'&#128279;',other:'&#128206;'};return m[d.type]||'&#128206;';}
function momPreview(c){if(!c)return'No content yet...';try{var d=JSON.parse(c);if(d&&Array.isArray(d.ops)){var t=d.ops.map(o=>typeof o.insert==='string'?o.insert:'').join('').replace(/\n/g,' ').trim();return esc(t.substring(0,140)+(t.length>140?'...':''));}}catch(e){}var tmp=document.createElement('div');tmp.innerHTML=c;var t2=(tmp.textContent||tmp.innerText||'').replace(/\s+/g,' ').trim();return esc(t2.substring(0,140)+(t2.length>140?'...':''));}
async function hw(pw){var b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(pw));return Array.from(new Uint8Array(b)).map(v=>v.toString(16).padStart(2,'0')).join('');}
async function imp(pw){return false;}
function ifl(id){var f=gf(id);return f&&f.pw&&!UF.has(id);}
function goHome(){VIEW='home';PATH=[];EMOM=null;destroyEditor();closeCtx();history.pushState(null,'',buildHash());render();}
function goTo(path){if(typeof canSeeFolder==='function'&&!canSeeFolder(path[path.length-1])){toast('You don\'t have access to this folder.');goHome();return;}for(var i=0;i<path.length;i++){if(ifl(path[i])){unlockFolder(path[i],path);return;}}PATH=path;VIEW='folder';TAB='sub';EMOM=null;destroyEditor();DOC_FOLDER=null;MOM_FOLDER=null;path.forEach(id=>EXP.add(id));saveExp();closeCtx();history.pushState(null,'',buildHash());render();}
function goId(id){goTo(pathTo(id));}
function setTab(t){TAB=t;DOC_FOLDER=null;MOM_FOLDER=null;renderMain();}
function showCtx(e,fid){
  e.stopPropagation();closeCtx();var f=gf(fid);if(!f)return;
  var el=document.createElement('div');el.className='ctx';el.id='CTX';
  var iOpen='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
  var iRename='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  var iSub='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>';
  var iLock='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
  var iDel='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
  var h='<div class="ct" data-a="open" data-id="'+fid+'">'+iOpen+'Open</div>';
  h+='<div class="ct" data-a="rename" data-id="'+fid+'">'+iRename+'Rename</div>';
  if(CURR_USER_ROLE==='admin')h+='<div class="ct" data-a="sub" data-id="'+fid+'">'+iSub+'Add subfolder</div>';
  h+='<div class="cd"></div>';
  if(f.pw&&UF.has(fid))h+='<div class="ct wa" data-a="relock" data-id="'+fid+'">'+iLock+'Lock again</div>';
  h+='<div class="ct '+(f.pw?'wa':'')+'" data-a="lock" data-id="'+fid+'">'+iLock+(f.pw?'Change lock':'Set lock')+'</div>';
  if(CURR_USER_ROLE==='admin')h+='<div class="cd"></div><div class="ct" data-a="access" data-id="'+fid+'">&#128274; Manage Access</div>';
  h+='<div class="cd"></div><div class="ct da" data-a="del" data-id="'+fid+'">'+iDel+'Delete</div>';
  el.innerHTML=h;
  el.addEventListener('click',ev=>{var t=ev.target.closest('[data-a]');if(!t)return;var a=t.dataset.a,id=t.dataset.id;closeCtx();if(a==='open')goId(id);else if(a==='rename')openRename(id);else if(a==='sub')openNewFolder(id);else if(a==='relock')relock(id);else if(a==='lock')openLockModal('folder',id);else if(a==='access')openAccessModal(id);else if(a==='del')askDeleteFolder(id);});
  document.getElementById('CR').appendChild(el);el.style.left=Math.min(e.clientX,innerWidth-240)+'px';el.style.top=Math.min(e.clientY,innerHeight-260)+'px';
}
function closeCtx(){var m=document.getElementById('CTX');if(m)m.remove();}
document.addEventListener('click',closeCtx);
function render(){renderTree();renderBC();renderTB();renderMain();history.replaceState(null,'',buildHash());}
function renderTree(){var el=document.getElementById('tree');el.innerHTML='';kids(null).filter(f=>canSeeFolder(f.id)).forEach(f=>buildNode(el,f,0));}
function buildNode(par,f,d){
  var ch=kids(f.id).filter(c=>canSeeFolder(c.id)),act=PATH[PATH.length-1]===f.id,exp=EXP.has(f.id);
  var el=document.createElement('div');el.className='ti'+(act?' on':'');el.style.setProperty('--d',d);
  el.innerHTML='<span class="ic">'+(f.icon||'&#128193;')+'</span><span class="nm">'+esc(f.name)+'</span>'+(f.pw?'<span class="lk">&#128274;</span>':'')+'<span class="cv'+(exp?' op':'')+'" data-tog="'+f.id+'">'+(ch.length?'&#9658;':'')+'</span><button class="mb" data-fid="'+f.id+'">&#8943;</button>';
  el.querySelector('.mb').addEventListener('click',e=>{e.stopPropagation();showCtx(e,f.id);});
  var cvEl=el.querySelector('.cv[data-tog]');
  if(cvEl&&ch.length){cvEl.style.cursor='pointer';cvEl.style.padding='2px 4px';cvEl.addEventListener('click',e=>{e.stopPropagation();var isExp=EXP.has(f.id);isExp?EXP.delete(f.id):EXP.add(f.id);saveExp();renderTree();});}
  el.addEventListener('click',e=>{if(e.target.closest('.mb')||e.target.closest('.cv[data-tog]'))return;goTo(pathTo(f.id));});
  par.appendChild(el);if(exp&&!ifl(f.id))ch.forEach(c=>buildNode(par,c,d+1));
}
function renderBC(){
  var el=document.getElementById('bc');
  var h='<span class="bc-i" id="bc-home">Workbase</span>';
  if(VIEW==='home'&&!PATH.length){h+='<span class="bc-s">&#8250;</span><span class="bc-i cur">Home</span>';}
  PATH.forEach((id,i)=>{var f=gf(id);if(!f)return;var cur=i===PATH.length-1&&VIEW!=='mom';h+='<span class="bc-s">&#8250;</span><span class="bc-i'+(cur?' cur':'')+'" data-bcid="'+id+'">'+esc(f.name)+(f.pw?' &#128274;':'')+'</span>';});
  if(VIEW==='mom'&&EMOM)h+='<span class="bc-s">&#8250;</span><span class="bc-i cur">'+esc(EMOM.title||'MoM')+'</span>';
  el.innerHTML=h;
  var hb=document.getElementById('bc-home');if(hb)hb.addEventListener('click',goHome);
  el.querySelectorAll('[data-bcid]').forEach(b=>b.addEventListener('click',()=>goId(b.dataset.bcid)));
  // populate date chip
  var dc=document.getElementById('tb-date');
  if(dc){var now=new Date();var days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];dc.innerHTML='&#128197; '+days[now.getDay()]+', '+now.getDate()+' '+months[now.getMonth()];}
}
function renderTB(){
  var el=document.getElementById('ta');el.innerHTML='';
  if(VIEW==='folder'){
    var f=cf();if(!f)return;
    var r=document.createElement('button');r.className='btn se sm';r.textContent='Rename';r.addEventListener('click',()=>openRename(f.id));el.appendChild(r);
    if(f.pw&&UF.has(f.id)){var lk=document.createElement('button');lk.className='btn wa sm';lk.textContent='Lock';lk.addEventListener('click',()=>relock(f.id));el.appendChild(lk);}
    var sl=document.createElement('button');sl.className='btn se sm';sl.textContent=f.pw?'Change Lock':'Set Lock';sl.addEventListener('click',()=>openLockModal('folder',f.id));el.appendChild(sl);
  }else if(VIEW==='mom'){
    var ep=document.createElement('button');ep.className='btn gr sm';ep.textContent='Export PDF';ep.addEventListener('click',exportPDF);el.appendChild(ep);
    var sv=document.createElement('button');sv.className='btn pr sm';sv.textContent='Save';sv.addEventListener('click',saveMom);el.appendChild(sv);
  }
}
function renderMain(){
  var el=document.getElementById('ca');
  if(VIEW==='home')el.innerHTML=homeHTML();
  else if(VIEW==='folder')el.innerHTML=folderHTML();
  else if(VIEW==='mom'){el.innerHTML=momEdHTML();bindMomEditor();}
  bindMainEvents();
}
function bindMainEvents(){
  var ca=document.getElementById('ca');
  ca.querySelectorAll('[data-tab]').forEach(el=>el.addEventListener('click',()=>setTab(el.dataset.tab)));
  ca.querySelectorAll('[data-goto]').forEach(el=>el.addEventListener('click',()=>goId(el.dataset.goto)));
  ca.querySelectorAll('[data-ctx]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();showCtx(e,el.dataset.ctx);}));
  ca.querySelectorAll('[data-openmom]').forEach(el=>el.addEventListener('click',()=>openMom(el.dataset.openmom)));
  ca.querySelectorAll('[data-openurl]').forEach(el=>el.addEventListener('click',()=>window.open(el.dataset.openurl,'_blank')));
  ca.querySelectorAll('[data-lightbox]').forEach(el=>el.addEventListener('click',()=>openLightbox(el.dataset.lightbox,el.dataset.lbname)));
  ca.querySelectorAll('[data-unlockdoc]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();unlockDoc(el.dataset.unlockdoc);}));
  ca.querySelectorAll('[data-relockdoc]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();relockDoc(el.dataset.relockdoc);}));
  ca.querySelectorAll('[data-lockdoc]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();openLockModal('doc',el.dataset.lockdoc);}));
  ca.querySelectorAll('[data-deldoc]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();dD(el.dataset.deldoc);}));
  ca.querySelectorAll('[data-movedoc]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();openMoveModal('doc',el.dataset.movedoc);}));
  ca.querySelectorAll('[data-opendocfolder]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();DOC_FOLDER=el.dataset.opendocfolder;renderMain();}));
  ca.querySelectorAll('[data-newdocfolder]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();openNewDocFolder(el.dataset.newdocfolder);}));
  ca.querySelectorAll('[data-renamedocfolder]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();openRenameDocFolder(el.dataset.renamedocfolder);}));
  ca.querySelectorAll('[data-deldocfolder]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();askDeleteDocFolder(el.dataset.deldocfolder);}));
  var dfb=ca.querySelector('#docfolder-back');if(dfb)dfb.addEventListener('click',()=>{DOC_FOLDER=null;renderMain();});
  ca.querySelectorAll('[data-openmomfolder]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();MOM_FOLDER=el.dataset.openmomfolder;renderMain();}));
  ca.querySelectorAll('[data-newmomfolder]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();openNewMomFolder(el.dataset.newmomfolder);}));
  ca.querySelectorAll('[data-renamemomfolder]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();openRenameMomFolder(el.dataset.renamemomfolder);}));
  ca.querySelectorAll('[data-delmomfolder]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();askDeleteMomFolder(el.dataset.delmomfolder);}));
  var mfb=ca.querySelector('#momfolder-back');if(mfb)mfb.addEventListener('click',()=>{MOM_FOLDER=null;renderMain();});
  ca.querySelectorAll('[data-movemom]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();openMoveModal('mom',el.dataset.movemom);}));
  ca.querySelectorAll('[data-renamemom]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();openRenameMom(el.dataset.renamemom);}));
  ca.querySelectorAll('[data-delmom]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();askDelMomFromCard(el.dataset.delmom);}));
  ca.querySelectorAll('[data-renamedoc]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();openRenameDoc(el.dataset.renamedoc);}));
  ca.querySelectorAll('[data-dldoc]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();downloadFile(el.dataset.dldoc,el.dataset.dlname);}));
  ca.querySelectorAll('[data-delfolder]').forEach(el=>el.addEventListener('click',()=>askDeleteFolder(el.dataset.delfolder)));
  ca.querySelectorAll('[data-starmom]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();var m=M.find(v=>v.id===el.dataset.starmom);if(m){m.starred=!m.starred;sM(m);}}));
  ca.querySelectorAll('[data-stardoc]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();var d=D.find(v=>v.id===el.dataset.stardoc);if(d){d.starred=!d.starred;sD(d);}}));
  ca.querySelectorAll('.ro-menu').forEach(function(el){el.addEventListener('click',function(e){e.stopPropagation();});});
  var nb=ca.querySelector('[data-newmom]');if(nb)nb.addEventListener('click',newMom);
  var ab=ca.querySelector('[data-adddoc]');if(ab)ab.addEventListener('click',openAddDoc);
  ca.querySelectorAll('[data-newsub]').forEach(sb=>sb.addEventListener('click',e=>{e.stopPropagation();openNewFolder(sb.dataset.newsub);}));
  var afc=ca.querySelector('[data-addfolder]');if(afc)afc.addEventListener('click',()=>openNewFolder(null));
  var fb=ca.querySelector('#folder-back');if(fb)fb.addEventListener('click',()=>{var f=cf();if(f&&f.parent){var par=gf(f.parent);if(par)goTo(pathTo(par.id));else goHome();}else goHome();});
  // search + sort
  var ms=ca.querySelector('#mom-search');var msort=ca.querySelector('#mom-sort');
  if(ms)ms.addEventListener('input',applyMomFilter);
  if(msort)msort.addEventListener('change',applyMomFilter);
  var ds=ca.querySelector('#doc-search');var dsort=ca.querySelector('#doc-sort');
  if(ds)ds.addEventListener('input',applyDocFilter);
  if(dsort)dsort.addEventListener('change',applyDocFilter);
}
function applyMomFilter(){
  var q=(document.getElementById('mom-search')||{}).value||'';
  var sort=(document.getElementById('mom-sort')||{}).value||'date';
  var q2=q.toLowerCase();
  var list=document.querySelector('#ca .ml');if(!list)return;
  var cards=Array.from(list.querySelectorAll('.mc'));
  cards.forEach(c=>{var t=(c.querySelector('.mc-title')||{}).textContent||'';var p=(c.querySelector('.mc-prev')||{}).textContent||'';c.style.display=(!q2||(t+p).toLowerCase().includes(q2))?'':'none';});
  if(sort==='name'){var vis=cards.filter(c=>c.style.display!=='none');vis.sort((a,b)=>((a.querySelector('.mc-title')||{}).textContent||'').localeCompare((b.querySelector('.mc-title')||{}).textContent||''));vis.forEach(c=>list.appendChild(c));}
}
function applyDocFilter(){
  var q=(document.getElementById('doc-search')||{}).value||'';
  var sort=(document.getElementById('doc-sort')||{}).value||'date';
  var q2=q.toLowerCase();
  var list=document.querySelector('#ca .dl');if(!list)return;
  var cards=Array.from(list.querySelectorAll('.dc'));
  cards.forEach(c=>{var n=(c.querySelector('.dc-name')||{}).textContent||'';c.style.display=(!q2||n.toLowerCase().includes(q2))?'':'none';});
  if(sort==='name'){var vis=cards.filter(c=>c.style.display!=='none');vis.sort((a,b)=>((a.querySelector('.dc-name')||{}).textContent||'').localeCompare((b.querySelector('.dc-name')||{}).textContent||''));vis.forEach(c=>list.appendChild(c));}
}
// HOME
function homeHTML(){
  var r=kids(null).filter(f=>canSeeFolder(f.id));
  var iconPalette=['#EEF2FF','#F0FDF4','#FEF3C7','#FEE2E2','#F5F3FF','#ECFDF5','#FDF2F8','#EFF6FF'];
  // Recently opened: merge moms + docs sorted by date desc
  var recent=[];
  M.filter(function(m){return canSeeFolder(m.folderId);}).forEach(function(m){recent.push({type:'mom',id:m.id,name:m.title||'Untitled',folderId:m.folderId,date:m.date||0,obj:m});});
  D.filter(function(d){return canSeeFolder(d.folderId);}).forEach(function(d){recent.push({type:'doc',id:d.id,name:d.name||'Untitled',folderId:d.folderId,date:d.added||0,obj:d});});
  recent.sort(function(a,b){return b.date-a.date;});
  recent=recent.slice(0,5);
  var recentHTML='';
  if(CURR_USER_ROLE!=='admin')return'<div class="home"><div class="h-greet">My workspace</div><div><div class="home-sec-head"><span class="sec-l">Active Folders</span></div><div class="fg">'+r.map(function(f){return fcard(f,true);}).join('')+'</div></div></div>';
  if(recent.length){
    var rows=recent.map(function(item){
      var path=item.folderId?folderLabel(item.folderId):'';
      var badgeText,badgeStyle,iconBg,iconChar;
      if(item.type==='mom'){
        badgeText='Note';badgeStyle='background:#EEF2FF;color:#4F46E5';iconBg='#EEF2FF';iconChar='&#128221;';
      } else {
        var d=item.obj;
        if(d.cloudType==='image'||d.type==='image'){badgeText='Image';badgeStyle='background:#FEF3C7;color:#D97706';iconBg='#FEF3C7';iconChar='&#128247;';}
        else if(d.format==='pdf'||d.type==='pdf'){badgeText='PDF';badgeStyle='background:#FEE2E2;color:#DC2626';iconBg='#FEE2E2';iconChar='&#128196;';}
        else if(d.cloudType==='video'){badgeText='Video';badgeStyle='background:#F5F3FF;color:#7C3AED';iconBg='#F5F3FF';iconChar='&#127916;';}
        else{badgeText='Doc';badgeStyle='background:#ECFDF5;color:#059669';iconBg='#ECFDF5';iconChar='&#128196;';}
      }
      var clickAttr=item.type==='mom'?' data-openmom="'+item.id+'"':(item.obj.url?' data-openurl="'+esc(item.obj.url)+'"':'');
      return '<div class="ro-item"'+clickAttr+'>'+
        '<div class="ro-icon" style="background:'+iconBg+'">'+iconChar+'</div>'+
        '<div class="ro-info"><div class="ro-name">'+esc(item.name)+'</div>'+(path?'<div class="ro-path">'+esc(path)+'</div>':'')+'</div>'+
        '<span class="ro-badge" style="'+badgeStyle+'">'+badgeText+'</span>'+
        '<span class="ro-time">'+fmtDate(item.date)+'</span>'+
        '<button class="ro-menu">&#8942;</button>'+
      '</div>';
    }).join('');
    recentHTML='<div style="margin-top:32px">'+
      '<div class="home-sec-head"><span class="sec-l">Recently Opened</span><button class="home-view-all">View all</button></div>'+
      '<div class="ro-list">'+rows+'</div></div>';
  }
  return '<div class="home">'+
    '<div class="h-greet">My workspace</div>'+
    '<div><div class="home-sec-head"><span class="sec-l">Active Folders</span><button class="home-view-all">View all</button></div>'+
    '<div class="fg">'+r.map(function(f){return fcard(f,true);}).join('')+(CURR_USER_ROLE==='admin'?'<div class="add-c" data-addfolder><div class="add-c-plus">+</div><div class="add-c-lbl">New folder</div></div>':'')+'</div></div>'+
    recentHTML+
  '</div>';
}
function fcard(f,big){
  var n=cnt(f.id),lkd=!!f.pw,meta=lkd&&!UF.has(f.id)?'Password protected':n+' item'+(n!==1?'s':'');
  var palette=['#EEF2FF','#F0FDF4','#FEF3C7','#FEE2E2','#F5F3FF','#ECFDF5','#FDF2F8','#EFF6FF'];
  var ci=Math.abs(f.id.split('').reduce(function(a,c){return a+c.charCodeAt(0);},0))%palette.length;
  var ibg=palette[ci];
  return '<div class="fc'+(lkd?' lkd':'')+'" data-goto="'+f.id+'">'+
    '<div class="fc-top">'+
      '<div class="fc-icon-wrap" style="background:'+ibg+'">'+(f.icon||'&#128193;')+(lkd?'<span style="font-size:11px">&#128274;</span>':'')+'</div>'+
      '<div style="display:flex;align-items:center;gap:6px">'+(big?'<div class="fc-active-dot"></div>':'')+'<button class="fc-mb" data-ctx="'+f.id+'">&#8943;</button></div>'+
    '</div>'+
    '<div class="fc-name">'+esc(f.name)+'</div>'+
    '<div class="fc-meta">'+meta+'</div>'+
  '</div>';
}
// FOLDER VIEW
function folderHTML(){
  var f=cf();if(!f)return'';
  var s=kids(f.id),ms=momsOf(f.id),ds=docsOf(f.id),t=TAB;
  var starCount=ms.filter(m=>m.starred).length+ds.filter(d=>d.starred).length;
  var palette=['#EEF2FF','#F0FDF4','#FEF3C7','#FEE2E2','#F5F3FF','#ECFDF5','#FDF2F8','#EFF6FF'];
  var ci=Math.abs(f.id.split('').reduce((a,c)=>a+c.charCodeAt(0),0))%palette.length;
  var ibg=palette[ci];
  var iFldr='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
  var iDoc='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
  var iStar='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  var iTrash='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
  var iBack='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>';
  return '<div class="fv">'+
    '<div style="display:flex;align-items:center;gap:12px;padding:12px 20px;background:#fff;border:1px solid #E5E7EB;border-radius:12px;margin-bottom:20px">'+
      '<button class="back-btn" id="folder-back" style="display:flex;align-items:center;gap:5px;padding:6px 12px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;color:#374151;font-size:13px;cursor:pointer;font-family:inherit;white-space:nowrap">'+iBack+' Back</button>'+
      '<div style="width:40px;height:40px;border-radius:8px;background:'+ibg+';display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">'+(f.icon||'📁')+'</div>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-size:15px;font-weight:500;color:#111827;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(f.name)+(f.pw?' <span style="font-size:14px;opacity:.6">&#128274;</span>':'')+'</div>'+
        '<div style="font-size:11px;color:#9CA3AF;margin-top:3px">Created '+fmtDate(f.created)+' &nbsp;&middot;&nbsp; '+s.length+' subfolder'+(s.length!==1?'s':'')+' &nbsp;&middot;&nbsp; '+ms.length+' Document'+(ms.length!==1?'s':'')+' &nbsp;&middot;&nbsp; '+ds.length+' File'+(ds.length!==1?'s':'')+'</div>'+
      '</div>'+
      '<button style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:#FEF2F2;border:1px solid #FECACA;color:#EF4444;border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit;white-space:nowrap" data-delfolder="'+f.id+'">'+iTrash+' Delete</button>'+
    '</div>'+
    '<div class="tab-bar"><div class="tab'+(t==='sub'?' on':'')+'" data-tab="sub">'+iFldr+'Subfolders'+(s.length?'<span class="chip">'+s.length+'</span>':'')+'</div><div class="tab'+(t==='mom'?' on':'')+'" data-tab="mom">'+iDoc+'Documents'+(ms.length?'<span class="chip">'+ms.length+'</span>':'')+'</div><div class="tab'+(t==='doc'?' on':'')+'" data-tab="doc">'+iFldr+'Files'+(ds.length?'<span class="chip">'+ds.length+'</span>':'')+'</div><div class="tab'+(t==='star'?' on':'')+'" data-tab="star">'+iStar+'Starred'+(starCount?'<span class="chip">'+starCount+'</span>':'')+'</div></div>'+
    (t==='sub'?subHTML(s,f.id):'')+(t==='mom'?momListHTML(ms):'')+(t==='doc'?docListHTML(ds):'')+(t==='star'?starredTabHTML(f.id):'');
}
function subHTML(s,fid){
  var iSrch='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;color:#9CA3AF"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  var iGrid='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>';
  var iList='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>';
  var iFldr='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
  var h='<div class="sub-toolbar">'+
    '<div class="sub-search">'+iSrch+'<input type="text" placeholder="Search subfolders..." readonly></div>'+
    '<div style="display:flex;gap:4px">'+
      '<button class="sub-view-btn on">'+iGrid+'</button>'+
      '<button class="sub-view-btn">'+iList+'</button>'+
    '</div>'+
    '<div style="flex:1"></div>'+
    (CURR_USER_ROLE==='admin'?'<button class="btn dk" style="display:flex;align-items:center;gap:6px;padding:8px 14px" data-newsub="'+fid+'">'+iFldr+' New subfolder</button>':'')+
  '</div>';
  if(!s.length)return h+'<div class="empty"><div class="empty-ic">&#128193;</div><div class="empty-t">No subfolders yet</div><div class="empty-s">Break this space into sections</div></div>';
  var addCard=CURR_USER_ROLE==='admin'?'<div class="add-c" data-newsub="'+fid+'" style="min-height:120px"><div class="add-c-plus" style="width:36px;height:36px;border-radius:50%;background:#F3F4F6;display:flex;align-items:center;justify-content:center;font-size:20px;opacity:1;color:#6B7280">+</div><div class="add-c-lbl">New folder</div></div>':'';
  return h+'<div class="sg">'+s.map(f=>fcard(f,false)).join('')+addCard+'</div>';
}
function momCardHTML(m){
  var iNotes='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';
  var iRename='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  var iMove='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>';
  var iTrash='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>';
  var iDoc='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  return '<div class="mc" data-openmom="'+m.id+'">'+
    '<div class="dc-ic-box" style="background:#EEF2FF;color:#4F46E5">'+iNotes+'</div>'+
    '<div class="mc-title">'+esc(m.title||'Untitled')+'</div>'+
    '<div class="mc-prev" style="display:none">'+momPreview(m.content)+'</div>'+
    '<div class="mc-right">'+
      '<button class="star-btn'+(m.starred?' on':'')+'" data-starmom="'+m.id+'">&#9733;</button>'+
      '<div class="mc-act">'+
        (m.gdoc?'<a href="'+esc(m.gdoc)+'" target="_blank" class="ib" style="text-decoration:none;font-size:11px;padding:3px 6px" title="Google Doc">'+iDoc+' Doc</a>':'')+
        '<button class="ib" data-movemom="'+m.id+'" title="Move">'+iMove+'</button>'+
        '<button class="ib" data-renamemom="'+m.id+'" title="Rename">'+iRename+'</button>'+
        '<button class="ib" data-delmom="'+m.id+'" title="Delete">'+iTrash+'</button>'+
      '</div>'+
      '<span class="dc-date">'+fmtDate(m.date)+'</span>'+
    '</div>'+
  '</div>';
}
function momListHTML(ms){
  var f=cf();if(!f)return'';
  if(MOM_FOLDER){
    var mf=MF.find(v=>v.id===MOM_FOLDER);
    var mfmoms=momsOfMF(MOM_FOLDER).sort((a,b)=>b.date-a.date);
    var h='<div class="tab-actions" style="display:flex;gap:8px;align-items:center"><button class="btn se sm" id="momfolder-back">&#8592; Back</button><span style="font-size:13px;font-weight:600">&#128193; '+esc(mf?mf.name:'Folder')+'</span><div style="flex:1"></div><button class="btn pr sm" data-newmom>+ New MoM</button></div>';
    h+='<div class="search-bar"><input type="text" id="mom-search" placeholder="&#128269; Search MoMs..."><select id="mom-sort"><option value="date">Newest first</option><option value="name">Name A-Z</option></select></div>';
    if(!mfmoms.length)return h+'<div class="empty"><div class="empty-ic">&#128221;</div><div class="empty-t">No MoMs in this folder</div><div class="empty-s">Create a new MoM or move existing ones here</div></div>';
    return h+'<div class="ml">'+mfmoms.map(m=>momCardHTML(m)).join('')+'</div>';
  }
  var mfolders=momFoldersOf(f.id);
  var ungrp=momsUngrp(f.id).sort((a,b)=>b.date-a.date);
  var iSrchM='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  var iFldrM='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';
  var iChevM='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
  var h='<div style="margin-bottom:20px"><div style="font-size:22px;font-weight:700;color:#111827;margin-bottom:4px">Documents</div><div style="font-size:13px;color:#9CA3AF">Manage and organize your project files and assets.</div></div>';
  h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;flex-wrap:wrap">'+
    '<div style="display:flex;align-items:center;gap:8px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:7px 12px;flex:1;min-width:160px">'+iSrchM+'<input type="text" id="mom-search" placeholder="Search documents..." style="border:none;background:transparent;font-size:13px;font-family:inherit;color:#111827;outline:none;flex:1;min-width:0"></div>'+
    '<div style="display:flex;align-items:center;gap:6px;border:1px solid #E5E7EB;border-radius:8px;padding:7px 12px;background:#fff;font-size:13px;color:#374151;flex-shrink:0">'+
      '<select id="mom-sort" style="border:none;background:transparent;font-size:13px;font-family:inherit;color:#374151;outline:none;cursor:pointer;appearance:none;-webkit-appearance:none;padding-right:4px"><option value="date">Newest first</option><option value="name">Name A-Z</option></select>'+iChevM+
    '</div>'+
    '<button class="btn se" data-newmomfolder="'+f.id+'" style="display:flex;align-items:center;gap:5px;flex-shrink:0;font-size:13px;padding:7px 12px">'+iFldrM+' New document folder</button>'+
    '<button class="btn dk" data-newmom style="flex-shrink:0;font-size:13px;padding:7px 12px">+ Add Document</button>'+
  '</div>';
  var content='';
  var iFldrSVG='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';
  var iRenSVG='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  var iDelSVG='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>';
  if(mfolders.length){
    content+='<div class="df-section-lbl">Folders</div>';
    content+='<div class="ml" style="margin-bottom:16px">'+mfolders.map(mf=>{
      var mc=momsOfMF(mf.id).length;
      return '<div class="mc" data-openmomfolder="'+mf.id+'">'+
        '<div class="dc-ic-box" style="background:#EFF6FF;color:#3B82F6">'+iFldrSVG+'</div>'+
        '<div class="mc-title">'+esc(mf.name)+'</div>'+
        '<div class="mc-right"><div style="font-size:11px;color:#9CA3AF;margin-right:4px">'+mc+' MoM'+(mc!==1?'s':'')+'</div><div class="mc-act">'+
          '<button class="ib" data-renamemomfolder="'+mf.id+'" title="Rename">'+iRenSVG+'</button>'+
          '<button class="ib" data-delmomfolder="'+mf.id+'" title="Delete">'+iDelSVG+'</button>'+
        '</div></div>'+
      '</div>';
    }).join('')+'</div>';
  }
  if(!mfolders.length&&!ungrp.length)return h+'<div class="empty"><div class="empty-ic">&#128221;</div><div class="empty-t">No meeting notes yet</div><div class="empty-s">Log your first MoM or create a MoM folder</div></div>';
  if(ungrp.length){
    content+='<div class="df-section-lbl">Ungrouped</div>';
    content+='<div class="ml">'+ungrp.map(m=>momCardHTML(m)).join('')+'</div>';
  }
  return h+content;
}
function docCardHTML(d){
  var lkd=!!d.pw,ulkd=UD.has(d.id),show=!lkd||ulkd;
  var isImg=d.cloudType==='image'&&d.url&&show&&d.format!=='pdf'&&d.type!=='pdf';
  var clickAttr=isImg?'data-lightbox="'+esc(d.url)+'" data-lbname="'+esc(d.name)+'"':show&&d.url?'data-openurl="'+esc(d.url)+'"':'';
  var clickable=isImg||(show&&!!d.url);
  var icoMap={
    pdf:{bg:'#FEF2F2',cl:'#EF4444',sv:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>'},
    image:{bg:'#EFF6FF',cl:'#3B82F6',sv:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'},
    video:{bg:'#F5F3FF',cl:'#8B5CF6',sv:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>'},
    link:{bg:'#F0FDF4',cl:'#22C55E',sv:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>'},
    spreadsheet:{bg:'#F0FDF4',cl:'#16A34A',sv:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>'},
    presentation:{bg:'#FFF7ED',cl:'#F97316',sv:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'}
  };
  var tp=d.format==='pdf'||d.type==='pdf'?'pdf':d.cloudType==='image'?'image':d.cloudType==='video'?'video':d.type||'other';
  var ico=icoMap[tp]||{bg:'#F3F4F6',cl:'#6B7280',sv:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'};
  var icBox=isImg?'<img class="dc-thumb" src="'+esc(d.url)+'" alt="'+esc(d.name)+'">'
    :'<div class="dc-ic-box" style="background:'+ico.bg+';color:'+ico.cl+'">'+ico.sv+'</div>';
  var badge=tp&&tp!=='other'?'<span class="dc-type-badge">'+tp.toUpperCase()+'</span>':'';
  var iRename='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  var iDl='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  var iMove='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>';
  var iLock='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>';
  var iUnlock='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>';
  var iTrash='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>';
  var iLink='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>';
  return '<div class="dc'+(lkd?' lkd':'')+(clickable?' dc-clickable':'')+'" '+clickAttr+'>'+
    icBox+
    '<div class="dc-inf"><div class="dc-name">'+esc(d.name)+(lkd?(ulkd?' &#128275;':' &#128274;'):'')+'</div><div class="dc-meta">'+(show&&d.note?esc(d.note):(!show?'Password protected':''))+'</div></div>'+
    '<div class="dc-right">'+
      '<button class="star-btn'+(d.starred?' on':'')+'" data-stardoc="'+d.id+'">&#9733;</button>'+
      badge+
      '<div class="dc-act">'+
        (show&&d.url?'<button class="ib" title="Copy link">'+iLink+'</button>':'')+
        (show&&d.url?'<button class="ib" data-dldoc="'+esc(d.url)+'" data-dlname="'+esc(d.name)+'" title="Download">'+iDl+'</button>':'')+
        '<button class="ib" data-movedoc="'+d.id+'" title="Move">'+iMove+'</button>'+
        (lkd&&ulkd?'<button class="ib" data-relockdoc="'+d.id+'" title="Re-lock">'+iLock+'</button>':'')+
        (lkd&&!ulkd?'<button class="ib" data-unlockdoc="'+d.id+'" title="Unlock">'+iUnlock+'</button>':'')+
        (!lkd?'<button class="ib" data-lockdoc="'+d.id+'" title="Lock">'+iLock+'</button>':'')+
        '<button class="ib" data-renamedoc="'+d.id+'" title="Rename">'+iRename+'</button>'+
        '<button class="ib" data-deldoc="'+d.id+'" title="Delete">'+iTrash+'</button>'+
      '</div>'+
      (d.added?'<span class="dc-date">'+fmtDate(d.added)+'</span>':'')+'</div>'+
    '</div>';
}
function docListHTML(ds){
  var f=cf();if(!f)return'';
  if(DOC_FOLDER){
    var df=DF.find(v=>v.id===DOC_FOLDER);
    var dfdocs=docsOfDF(DOC_FOLDER);
    var h='<div class="tab-actions" style="display:flex;gap:8px;align-items:center"><button class="btn se sm" id="docfolder-back">&#8592; Back</button><span style="font-size:13px;font-weight:600">&#128193; '+esc(df?df.name:'Folder')+'</span><div style="flex:1"></div><button class="btn pr sm" data-adddoc>+ Add Document</button></div>';
    h+='<div class="search-bar"><input type="text" id="doc-search" placeholder="&#128269; Search documents..."><select id="doc-sort"><option value="date">Newest first</option><option value="name">Name A-Z</option></select></div>';
    if(!dfdocs.length)return h+'<div class="empty"><div class="empty-ic">&#128206;</div><div class="empty-t">No documents in this folder</div><div class="empty-s">Add documents or move existing ones here</div></div>';
    return h+'<div class="dl">'+dfdocs.map(d=>docCardHTML(d)).join('')+'</div>';
  }
  var dfolders=docFoldersOf(f.id);
  var ungrp=docsUngrp(f.id);
  var iSrchD='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  var iFldrD='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';
  var iChevD='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
  var h='<div style="margin-bottom:20px"><div style="font-size:22px;font-weight:700;color:#111827;margin-bottom:4px">Files</div><div style="font-size:13px;color:#9CA3AF">Upload and manage your documents, images, and assets.</div></div>';
  h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;flex-wrap:wrap">'+
    '<div style="display:flex;align-items:center;gap:8px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:7px 12px;flex:1;min-width:160px">'+iSrchD+'<input type="text" id="doc-search" placeholder="Search files..." style="border:none;background:transparent;font-size:13px;font-family:inherit;color:#111827;outline:none;flex:1;min-width:0"></div>'+
    '<div style="display:flex;align-items:center;gap:6px;border:1px solid #E5E7EB;border-radius:8px;padding:7px 12px;background:#fff;font-size:13px;color:#374151;flex-shrink:0">'+
      '<select id="doc-sort" style="border:none;background:transparent;font-size:13px;font-family:inherit;color:#374151;outline:none;cursor:pointer;appearance:none;-webkit-appearance:none;padding-right:4px"><option value="date">Newest first</option><option value="name">Name A-Z</option></select>'+iChevD+
    '</div>'+
    '<button class="btn se" data-newdocfolder="'+f.id+'" style="display:flex;align-items:center;gap:5px;flex-shrink:0;font-size:13px;padding:7px 12px">'+iFldrD+' New file folder</button>'+
    '<button class="btn dk" data-adddoc style="flex-shrink:0;font-size:13px;padding:7px 12px">+ Add File</button>'+
  '</div>';
  var content='';
  var iFldrSVG='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';
  var iRenSVG='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  var iDelSVG='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>';
  if(dfolders.length){
    content+='<div class="df-section-lbl">Folders</div>';
    content+='<div class="dl" style="margin-bottom:16px">'+dfolders.map(df=>{
      var dc=docsOfDF(df.id).length;
      return '<div class="dc dc-clickable" data-opendocfolder="'+df.id+'">'+
        '<div class="dc-ic-box" style="background:#EFF6FF;color:#3B82F6">'+iFldrSVG+'</div>'+
        '<div class="dc-inf"><div class="dc-name">'+esc(df.name)+'</div><div class="dc-meta">'+dc+' document'+(dc!==1?'s':'')+'</div></div>'+
        '<div class="dc-right"><div class="dc-act">'+
          '<button class="ib" data-renamedocfolder="'+df.id+'" title="Rename">'+iRenSVG+'</button>'+
          '<button class="ib" data-deldocfolder="'+df.id+'" title="Delete">'+iDelSVG+'</button>'+
        '</div></div></div>';
    }).join('')+'</div>';
  }
  if(!dfolders.length&&!ungrp.length)return h+'<div class="empty"><div class="empty-ic">&#128206;</div><div class="empty-t">No documents yet</div><div class="empty-s">Upload files, add links, or create doc folders</div></div>';
  if(ungrp.length){
    content+='<div class="df-section-lbl">Ungrouped</div>';
    content+='<div class="dl">'+ungrp.map(d=>docCardHTML(d)).join('')+'</div>';
  }
  return h+content;
}
function starredTabHTML(fid){
  var sm=momsOf(fid).filter(m=>m.starred).sort((a,b)=>b.date-a.date);
  var sd=docsOf(fid).filter(d=>d.starred);
  if(!sm.length&&!sd.length)return'<div class="empty"><div class="empty-ic">&#9733;</div><div class="empty-t">No starred items yet</div><div class="empty-s">Star any MoM or document to pin it here</div></div>';
  var iNotes='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
  var iPDF='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>';
  var iImg='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
  var iSheet='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>';
  var iFile='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  var iLink='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>';
  var iDl='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  var iMove='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>';
  var iTrash='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>';
  function docIcBox(d){
    var tp=d.format==='pdf'||d.type==='pdf'?'pdf':d.cloudType==='image'?'image':d.type==='spreadsheet'?'spreadsheet':'other';
    if(tp==='pdf')return'<div class="si-ic-box" style="background:#EFF6FF;color:#3B82F6">'+iPDF+'</div>';
    if(tp==='image')return'<div class="si-ic-box" style="background:#FFF7ED;color:#F97316">'+iImg+'</div>';
    if(tp==='spreadsheet')return'<div class="si-ic-box" style="background:#F0FDF4;color:#22C55E">'+iSheet+'</div>';
    return'<div class="si-ic-box" style="background:#F5F3FF;color:#8B5CF6">'+iFile+'</div>';
  }
  function docTag(d){
    var tp=d.format==='pdf'||d.type==='pdf'?'pdf':d.cloudType==='image'?'image':d.type==='spreadsheet'?'spreadsheet':d.type||'file';
    var map={pdf:{bg:'#EFF6FF',cl:'#3B82F6',lbl:'PDF'},image:{bg:'#FFF7ED',cl:'#F97316',lbl:'Image'},spreadsheet:{bg:'#F0FDF4',cl:'#22C55E',lbl:'Sheet'},link:{bg:'#F0FDF4',cl:'#16A34A',lbl:'Link'}};
    var s=map[tp]||{bg:'#F5F3FF',cl:'#8B5CF6',lbl:(tp||'File').charAt(0).toUpperCase()+(tp||'File').slice(1)};
    return'<span class="si-tag" style="background:'+s.bg+';color:'+s.cl+'">'+s.lbl+'</span>';
  }
  var total=sm.length+sd.length;
  var h='<div style="font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#9CA3AF;font-weight:600;margin-bottom:10px">'+total+' Starred Item'+(total!==1?'s':'')+'</div>';
  h+='<div class="starred-list">';
  h+=sm.map(m=>
    '<div class="si" data-openmom="'+m.id+'">'+
      '<div class="si-ic-box" style="background:#EEF2FF;color:#4F46E5">'+iNotes+'</div>'+
      '<div class="si-info"><div class="si-name">'+esc(m.title||'Untitled')+'</div><div class="si-meta">Added '+fmtDate(m.date)+'</div></div>'+
      '<div class="si-right">'+
        '<span class="si-tag" style="background:#EEF2FF;color:#4F46E5">Notes</span>'+
        '<div class="si-act">'+
          '<button class="ib" data-movemom="'+m.id+'" title="Move">'+iMove+'</button>'+
          '<button class="ib del" data-delmom="'+m.id+'" title="Delete">'+iTrash+'</button>'+
        '</div>'+
        '<span class="si-date">'+fmtDate(m.date)+'</span>'+
        '<button class="star-btn on" data-starmom="'+m.id+'">&#9733;</button>'+
      '</div>'+
    '</div>'
  ).join('');
  h+=sd.map(d=>{
    var isImg=d.cloudType==='image'&&d.url&&d.format!=='pdf';
    var ca=isImg?'data-lightbox="'+esc(d.url)+'" data-lbname="'+esc(d.name)+'"':d.url?'data-openurl="'+esc(d.url)+'"':'';
    return'<div class="si" '+ca+'>'+
      docIcBox(d)+
      '<div class="si-info"><div class="si-name">'+esc(d.name)+'</div><div class="si-meta">Added '+fmtDate(d.added)+'</div></div>'+
      '<div class="si-right">'+
        docTag(d)+
        '<div class="si-act">'+
          (d.url?'<button class="ib" title="Copy link">'+iLink+'</button>':'')+
          (d.url?'<button class="ib" data-dldoc="'+esc(d.url)+'" data-dlname="'+esc(d.name)+'" title="Download">'+iDl+'</button>':'')+
          '<button class="ib del" data-deldoc="'+d.id+'" title="Delete">'+iTrash+'</button>'+
        '</div>'+
        '<span class="si-date">'+fmtDate(d.added)+'</span>'+
        '<button class="star-btn on" data-stardoc="'+d.id+'">&#9733;</button>'+
      '</div>'+
    '</div>';
  }).join('');
  h+='</div><div class="si-footer">Starred items are synced across your workspace for quick access.</div>';
  return h;
}
// MOM EDITOR
function newMom(){var f=cf();if(!f)return;var m={id:uid(),folderId:f.id,title:'Meeting Notes',date:Date.now(),content:'',tags:[],starred:false};if(MOM_FOLDER)m.momFolderId=MOM_FOLDER;sM(m);EMOM=m;VIEW='mom';render();}
function openMom(id){var m=M.find(v=>v.id===id);if(!m)return;EMOM=m;VIEW='mom';if(!PATH.length||PATH[PATH.length-1]!==m.folderId){PATH=pathTo(m.folderId);PATH.forEach(id=>EXP.add(id));saveExp();}history.pushState(null,'',buildHash());render();}
function momEdHTML(){
  var m=EMOM;if(!m)return'';
  var fld=gf(m.folderId),dv=m.date?new Date(m.date).toISOString().split('T')[0]:'';
  var iBack='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>';
  var iFileLink='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>';
  var iDocLink='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
  return '<div class="me">'+
    '<div class="me-top">'+
      '<button class="back-btn" id="mom-back">'+iBack+' Back</button>'+
      '<div class="me-meta"><span>MOM</span><span style="color:#D1D5DB">›</span><span>'+esc((fld?fld.name:'').toUpperCase())+'</span></div>'+
    '</div>'+
    '<input class="inp-big" type="text" id="mt" value="'+esc(m.title)+'" placeholder="Meeting title...">'+
    '<div class="me-2col">'+
      '<div class="me-field"><label>Date</label><input type="date" id="md" value="'+dv+'"></div>'+
      '<div class="me-field"><label>Tags (comma separated)</label><input type="text" id="mg" value="'+esc((m.tags||[]).join(', '))+'" placeholder="e.g. client call, urgent"></div>'+
    '</div>'+
    '<div class="me-field fr">'+
      '<label>Google Doc Link (optional)</label>'+
      '<div style="display:flex;gap:8px">'+
        '<input type="url" id="mgdoc" value="'+esc(m.gdoc||'')+'" placeholder="https://docs.google.com/..." style="flex:1">'+
        (m.gdoc?'<a href="'+esc(m.gdoc)+'" target="_blank" class="btn se sm" style="white-space:nowrap;text-decoration:none;align-self:center">Open &#8599;</a>':'')+'</div>'+
    '</div>'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'+
      '<label style="margin:0;font-size:12px;color:#6B7280;font-weight:500">Notes</label>'+
      '<div style="display:flex;gap:6px">'+
        '<button class="btn se sm" id="insert-doc-btn" style="font-size:11px">'+iFileLink+' Insert File Link</button>'+
        '<button class="btn se sm" id="insert-mom-btn" style="font-size:11px">'+iDocLink+' Insert Document link</button>'+
      '</div>'+
    '</div>'+
    '<div id="tt-toolbar">'+
      '<select id="tt-heading"><option value="0">Normal</option><option value="1">H1</option><option value="2">H2</option><option value="3">H3</option></select>'+
      '<span class="tt-sep"></span>'+
      '<button type="button" class="tt-btn" data-cmd="bold"><b>B</b></button>'+
      '<button type="button" class="tt-btn" data-cmd="italic"><i>I</i></button>'+
      '<button type="button" class="tt-btn" data-cmd="underline"><u>U</u></button>'+
      '<button type="button" class="tt-btn" data-cmd="strike"><s>S</s></button>'+
      '<span class="tt-sep"></span>'+
      '<button type="button" class="tt-btn" data-cmd="bulletList">• List</button>'+
      '<button type="button" class="tt-btn" data-cmd="orderedList">1. List</button>'+
      '<span class="tt-sep"></span>'+
      '<button type="button" class="tt-btn" data-cmd="link">Link</button>'+
      '<span class="tt-sep"></span>'+
      '<label class="tt-color-wrap" title="Text color"><input type="color" id="tt-color" value="#111827"><span>A</span></label>'+
      '<label class="tt-color-wrap tt-hl-wrap" title="Highlight"><input type="color" id="tt-highlight" value="#FEF08A"><span style="background:#FEF08A">H</span></label>'+
      '<span class="tt-sep"></span>'+
      '<button type="button" class="tt-btn" data-cmd="insertTable">Table</button>'+
      '<button type="button" class="tt-btn tt-tbl" data-cmd="addRow">+Row</button>'+
      '<button type="button" class="tt-btn tt-tbl" data-cmd="delRow">−Row</button>'+
      '<button type="button" class="tt-btn tt-tbl" data-cmd="addCol">+Col</button>'+
      '<button type="button" class="tt-btn tt-tbl" data-cmd="delCol">−Col</button>'+
    '</div>'+
    '<div id="tiptap-editor" style="margin-bottom:20px"></div>'+
    '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;border-top:1px solid #F3F4F6;padding-top:16px;margin-top:4px">'+
      '<button class="btn dk" id="mom-save"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save</button>'+
      '<button class="btn se" id="mom-cancel"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancel</button>'+
      '<button class="btn se sm" id="mom-export"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export PDF</button>'+
      '<button class="btn se sm" id="mom-move"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg> Move</button>'+
      '<button class="btn se sm" id="mom-star" style="color:'+(m.starred?'#F59E0B':'#6B7280')+'"><svg width="13" height="13" viewBox="0 0 24 24" fill="'+(m.starred?'#F59E0B':'none')+'" stroke="'+(m.starred?'#F59E0B':'currentColor')+'" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> '+(m.starred?'Starred':'Star')+'</button>'+
      '<button class="btn da sm" style="margin-left:auto" id="mom-del"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg> Delete</button>'+
    '</div></div>';
}
function bindMomEditor(){
  if(!window._TT){setTimeout(bindMomEditor,100);return;}
  var TT=window._TT;
  function deltaToHTML(content){
    if(!content)return'';
    try{
      var d=JSON.parse(content);
      if(d&&Array.isArray(d.ops)){
        var tmp=document.createElement('div');
        tmp.style.cssText='position:absolute;left:-9999px;top:-9999px;visibility:hidden;width:400px';
        document.body.appendChild(tmp);
        var q=new Quill(tmp);
        q.setContents(d);
        var html=q.root.innerHTML;
        tmp.remove();
        return html;
      }
    }catch(e){}
    return content;
  }
  var initialHTML=EMOM?deltaToHTML(EMOM.content):'';
  _editor=new TT.Editor({
    element:document.getElementById('tiptap-editor'),
    extensions:[TT.StarterKit,TT.Table.configure({resizable:true}),TT.TableRow,TT.TableHeader,TT.TableCell,TT.Underline,TT.Link.configure({openOnClick:false}),TT.TextStyle,TT.Color,TT.Highlight.configure({multicolor:true})],
    content:initialHTML,
    editorProps:{attributes:{class:'tiptap',spellcheck:'true'}},
    onUpdate:function(){if(EMOM&&_editor)EMOM.content=_editor.getHTML();}
  });
  function updateTB(){
    if(!_editor)return;
    document.querySelectorAll('#tt-toolbar .tt-btn[data-cmd]').forEach(function(b){
      var c=b.dataset.cmd,on=false;
      if(c==='bold')on=_editor.isActive('bold');
      else if(c==='italic')on=_editor.isActive('italic');
      else if(c==='underline')on=_editor.isActive('underline');
      else if(c==='strike')on=_editor.isActive('strike');
      else if(c==='bulletList')on=_editor.isActive('bulletList');
      else if(c==='orderedList')on=_editor.isActive('orderedList');
      b.classList.toggle('active',on);
    });
    var hs=document.getElementById('tt-heading');
    if(hs){
      if(_editor.isActive('heading',{level:1}))hs.value='1';
      else if(_editor.isActive('heading',{level:2}))hs.value='2';
      else if(_editor.isActive('heading',{level:3}))hs.value='3';
      else hs.value='0';
    }
  }
  _editor.on('selectionUpdate',updateTB);
  _editor.on('transaction',updateTB);
  var tb=document.getElementById('tt-toolbar');
  if(tb){
    tb.querySelectorAll('.tt-btn[data-cmd]').forEach(function(btn){
      btn.addEventListener('click',function(e){
        e.preventDefault();var c=btn.dataset.cmd;
        if(c==='bold')_editor.chain().focus().toggleBold().run();
        else if(c==='italic')_editor.chain().focus().toggleItalic().run();
        else if(c==='underline')_editor.chain().focus().toggleUnderline().run();
        else if(c==='strike')_editor.chain().focus().toggleStrike().run();
        else if(c==='bulletList')_editor.chain().focus().toggleBulletList().run();
        else if(c==='orderedList')_editor.chain().focus().toggleOrderedList().run();
        else if(c==='link'){var u=prompt('Enter URL (leave blank to remove link):');if(u)_editor.chain().focus().setLink({href:u}).run();else _editor.chain().focus().unsetLink().run();}
        else if(c==='insertTable')_editor.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run();
        else if(c==='addRow')_editor.chain().focus().addRowAfter().run();
        else if(c==='delRow')_editor.chain().focus().deleteRow().run();
        else if(c==='addCol')_editor.chain().focus().addColumnAfter().run();
        else if(c==='delCol')_editor.chain().focus().deleteColumn().run();
      });
    });
    var hs=document.getElementById('tt-heading');
    if(hs)hs.addEventListener('change',function(){
      var v=parseInt(this.value);
      if(v===0)_editor.chain().focus().setParagraph().run();
      else _editor.chain().focus().setHeading({level:v}).run();
    });
    var tc=document.getElementById('tt-color');
    if(tc)tc.addEventListener('input',function(){_editor.chain().focus().setColor(this.value).run();});
    var th=document.getElementById('tt-highlight');
    if(th)th.addEventListener('input',function(){_editor.chain().focus().setHighlight({color:this.value}).run();});
  }
  document.getElementById('mom-back').addEventListener('click',backMom);
  document.getElementById('mom-save').addEventListener('click',saveMom);
  document.getElementById('mom-cancel').addEventListener('click',backMom);
  document.getElementById('mom-export').addEventListener('click',exportPDF);
  document.getElementById('mom-del').addEventListener('click',()=>askDelMom(EMOM.id));
  document.getElementById('mom-move').addEventListener('click',()=>openMoveModal('mom',EMOM.id));
  document.getElementById('mom-star').addEventListener('click',()=>{if(EMOM){EMOM.starred=!EMOM.starred;sM(EMOM);var b=document.getElementById('mom-star');if(b){var starSVG='<svg width="13" height="13" viewBox="0 0 24 24" fill="'+(EMOM.starred?'#F59E0B':'none')+'" stroke="'+(EMOM.starred?'#F59E0B':'currentColor')+'" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';b.style.color=EMOM.starred?'#F59E0B':'#6B7280';b.innerHTML=starSVG+' '+(EMOM.starred?'Starred':'Star');}}});
  var ib=document.getElementById('insert-doc-btn');if(ib)ib.addEventListener('click',()=>openDocPicker(EMOM.folderId));
  var imb=document.getElementById('insert-mom-btn');if(imb)imb.addEventListener('click',()=>openMomPicker(EMOM.id));
  document.getElementById('tiptap-editor').addEventListener('click',e=>{var a=e.target.closest('a');if(a&&a.href&&a.href.includes('mom.local/')){e.preventDefault();var mid=a.href.split('mom.local/')[1];if(mid){saveMom();openMom(mid);}}});
}
function insertDocLink(name,url){if(_editor){_editor.chain().focus().insertContent('<a href="'+esc(url)+'">'+esc(name)+'</a> ').run();if(EMOM)EMOM.content=_editor.getHTML();}}
function collectMom(){
  if(!EMOM)return;
  var t=document.getElementById('mt'),d=document.getElementById('md'),g=document.getElementById('mg'),gd=document.getElementById('mgdoc');
  if(t)EMOM.title=t.value||EMOM.title;
  if(d&&d.value)EMOM.date=new Date(d.value).getTime();
  if(g)EMOM.tags=g.value.split(',').map(v=>v.trim()).filter(Boolean);
  if(_editor)EMOM.content=_editor.getHTML();
  if(gd)EMOM.gdoc=gd.value.trim();
}
function saveMom(){collectMom();if(EMOM)sM(EMOM);destroyEditor();backMom();}
function backMom(){collectMom();if(EMOM)sM(EMOM);var mf=EMOM?EMOM.momFolderId||null:null;destroyEditor();VIEW='folder';TAB='mom';EMOM=null;MOM_FOLDER=mf;history.pushState(null,'',buildHash());render();}
function askDelMom(id){
  modal('<div class="m-title">Delete this MoM?</div><div class="dz"><p>Permanently deleted.</p><div style="display:flex;gap:8px"><button class="btn se" id="dm-c">Cancel</button><button class="btn da" id="dm-d">Delete</button></div></div>');
  document.getElementById('dm-c').addEventListener('click',closeModal);
  document.getElementById('dm-d').addEventListener('click',()=>{dM(id);EMOM=null;destroyEditor();VIEW='folder';TAB='mom';closeModal();render();});
}
function askDelMomFromCard(id){
  var m=M.find(v=>v.id===id);if(!m)return;
  modal('<div class="m-title">Delete "'+esc(m.title||'Untitled')+'"?</div><div class="dz"><p>Permanently deleted. Cannot be undone.</p><div style="display:flex;gap:8px"><button class="btn se" id="dmc-c">Cancel</button><button class="btn da" id="dmc-d">Delete</button></div></div>');
  document.getElementById('dmc-c').addEventListener('click',closeModal);
  document.getElementById('dmc-d').addEventListener('click',()=>{dM(id);closeModal();toast('MoM deleted.');});
}
function openRenameMom(id){
  var m=M.find(v=>v.id===id);if(!m)return;
  modal('<div class="m-title">&#9999; Rename MoM</div><div class="fr"><label>Title</label><input type="text" id="rm-n" value="'+esc(m.title||'')+'"></div><div class="m-foot"><button class="btn se" id="rm-c">Cancel</button><button class="btn pr" id="rm-s">Save</button></div>');
  var inp=document.getElementById('rm-n');inp.focus();inp.select();
  document.getElementById('rm-c').addEventListener('click',closeModal);
  document.getElementById('rm-s').addEventListener('click',()=>{var n=inp.value.trim();if(!n)return;m.title=n;sM(m);closeModal();toast('Renamed.');});
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){var n=inp.value.trim();if(!n)return;m.title=n;sM(m);closeModal();toast('Renamed.');}});
}
function exportPDF(){
  collectMom();var m=EMOM;if(!m)return;var fld=gf(m.folderId);
  var body=_editor?_editor.getHTML():'<p>'+esc(m.content||'')+'</p>';
  document.getElementById('pdf-print').innerHTML='<h1>'+esc(m.title||'Meeting Notes')+'</h1><div class="pm">'+(fld?'Folder: '+esc(fld.name)+' &nbsp;&middot;&nbsp; ':'')+'Date: '+fmtDate(m.date)+(m.tags&&m.tags.length?' &nbsp;&middot;&nbsp; Tags: '+m.tags.map(t=>esc(t)).join(', '):'')+'</div><div class="pb">'+body+'</div>'+(m.tags&&m.tags.length?'<div class="pt">'+m.tags.map(t=>'<span class="ptag">'+esc(t)+'</span>').join('')+'</div>':'')+'<div style="margin-top:40px;font-size:11px;color:#9CA3AF">Exported from Greg\'s Workspace &middot; '+new Date().toLocaleDateString()+'</div>';
  window.print();
}
// DOC PICKER
function openDocPicker(folderId){
  var alldocs=D.filter(d=>d.url).sort((a,b)=>esc(a.name).localeCompare(esc(b.name)));
  if(!alldocs.length){toast('No documents with links found anywhere.');return;}
  var iLinkIco='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>';
  var iSrchIco='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  var iChkIco='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
  var iInsIco='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>';
  var fileIcoMap={
    pdf:{bg:'#FEF2F2',cl:'#EF4444',sv:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/></svg>'},
    image:{bg:'#FFF7ED',cl:'#F97316',sv:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'},
    video:{bg:'#F5F3FF',cl:'#8B5CF6',sv:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>'},
    spreadsheet:{bg:'#F0FDF4',cl:'#16A34A',sv:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>'},
    link:{bg:'#EFF6FF',cl:'#3B82F6',sv:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>'}
  };
  function fileIcBox(d){var tp=d.format==='pdf'||d.type==='pdf'?'pdf':d.cloudType==='image'?'image':d.cloudType==='video'?'video':d.type==='spreadsheet'?'spreadsheet':d.type==='link'?'link':'other';var ic=fileIcoMap[tp]||{bg:'#F3F4F6',cl:'#6B7280',sv:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'};return'<div style="width:30px;height:30px;border-radius:6px;background:'+ic.bg+';color:'+ic.cl+';display:flex;align-items:center;justify-content:center;flex-shrink:0">'+ic.sv+'</div>';}
  function renderList(q){
    var filtered=q?alldocs.filter(d=>d.name.toLowerCase().includes(q)):alldocs;
    var container=document.getElementById('dp-list');if(!container)return;
    container.innerHTML=filtered.map(d=>{
      var fld=gf(d.folderId);var loc=fld?folderLabel(d.folderId):'';
      return'<div class="dp-item" data-name="'+esc(d.name)+'" data-url="'+esc(d.url)+'">'+fileIcBox(d)+'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500;color:#111827;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(d.name)+'</div>'+(loc?'<div style="font-size:11px;color:#9CA3AF;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(loc)+'</div>':'')+'</div><span class="dp-check">'+iChkIco+'</span></div>';
    }).join('')||(q?'<div style="padding:16px;text-align:center;color:#9CA3AF;font-size:13px">No results for "'+esc(q)+'"</div>':'');
    container.querySelectorAll('.dp-item').forEach(el=>el.addEventListener('click',()=>el.classList.toggle('sel')));
  }
  modal(
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">'+
      '<div style="width:32px;height:32px;border-radius:8px;background:#EFF6FF;color:#3B82F6;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+iLinkIco+'</div>'+
      '<div><div style="font-size:15px;font-weight:600;color:#111827">Insert File Link</div>'+
      '<div style="font-size:12px;color:#9CA3AF;margin-top:1px">Search and select files from anywhere in your workspace.</div></div>'+
    '</div>'+
    '<div style="display:flex;align-items:center;gap:8px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:8px 12px;margin:14px 0 6px">'+iSrchIco+'<input type="text" id="dp-search" placeholder="Search by name..." style="border:none;background:transparent;font-size:13px;font-family:inherit;color:#111827;outline:none;flex:1"></div>'+
    '<div id="dp-list" style="display:flex;flex-direction:column;gap:2px;max-height:300px;overflow-y:auto;margin-bottom:4px"></div>'+
    '<div class="m-foot"><button class="btn se" id="dp-c">Cancel</button><button class="btn dk" id="dp-i" style="display:flex;align-items:center;gap:6px">'+iInsIco+' Insert selected</button></div>'
  );
  renderList('');
  document.getElementById('dp-search').addEventListener('input',e=>renderList(e.target.value.toLowerCase().trim()));
  document.getElementById('dp-c').addEventListener('click',closeModal);
  document.getElementById('dp-i').addEventListener('click',()=>{var sel=document.getElementById('dp-list').querySelectorAll('.dp-item.sel');if(!sel.length){toast('Select at least one document first.');return;}sel.forEach(el=>insertDocLink(el.dataset.name,el.dataset.url));closeModal();toast(sel.length+' link'+(sel.length>1?'s':'')+' inserted.');});
}
// MOM PICKER
function openMomPicker(currentMomId){
  var allMoms=M.filter(m=>m.id!==currentMomId).sort((a,b)=>b.date-a.date);
  if(!allMoms.length){toast('No other MoMs to link to yet.');return;}
  var iDocIco='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
  var iChk='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
  var iInsert='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>';
  modal('<div class="m-title" style="display:flex;align-items:center;gap:8px"><div style="width:32px;height:32px;border-radius:8px;background:#FFF7ED;color:#F97316;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+iDocIco+'</div><div><div style="font-size:15px;font-weight:600;color:#111827">Insert Doc Link</div><div style="font-size:12px;color:#9CA3AF;font-weight:400;margin-top:1px">Select MoMs to insert as links into your notes.</div></div></div><div id="mp-list" style="display:flex;flex-direction:column;gap:2px;max-height:340px;overflow-y:auto;margin:16px 0 4px">'+allMoms.map(m=>{var fld=gf(m.folderId);return'<div class="dp-item" data-momid="'+m.id+'" data-name="'+esc(m.title||'Untitled')+'"><div style="width:30px;height:30px;border-radius:6px;background:#FFF7ED;color:#F97316;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+iDocIco+'</div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500;color:#111827;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(m.title||'Untitled')+'</div><div style="font-size:11px;color:#9CA3AF;margin-top:2px">'+esc(fld?fld.name:'')+(m.date?' &middot; '+fmtDate(m.date):'')+'</div></div><span class="dp-check">'+iChk+'</span></div>';}).join('')+'</div><div class="m-foot"><button class="btn se" id="mp-c">Cancel</button><button class="btn dk" id="mp-i" style="display:flex;align-items:center;gap:6px">'+iInsert+' Insert selected</button></div>');
  document.getElementById('mp-c').addEventListener('click',closeModal);
  document.getElementById('mp-list').querySelectorAll('.dp-item').forEach(el=>el.addEventListener('click',()=>el.classList.toggle('sel')));
  document.getElementById('mp-i').addEventListener('click',()=>{
    var sel=document.getElementById('mp-list').querySelectorAll('.dp-item.sel');
    if(!sel.length){toast('Select at least one MoM first.');return;}
    sel.forEach(el=>{
      var mid=el.dataset.momid,name=el.dataset.name;
      if(_editor){_editor.chain().focus().insertContent('<a href="https://mom.local/'+mid+'">📝 '+esc(name)+'</a> ').run();if(EMOM)EMOM.content=_editor.getHTML();}
    });
    closeModal();toast(sel.length+' MoM link'+(sel.length>1?'s':'')+' inserted.');
  });
}
// MOVE MODAL - full tree
function openMoveModal(type,itemId){
  var item=type==='mom'?M.find(m=>m.id===itemId):D.find(d=>d.id===itemId);if(!item)return;
  var curFid=item.folderId;
  var curDFid=type==='doc'?(item.docFolderId||null):null;
  var curMFid=type==='mom'?(item.momFolderId||null):null;
  var curSFid=type==='doc'?curDFid:curMFid;
  function buildTree(pid,depth){
    return F.filter(f=>f.parent===pid).map(f=>{
      var isCur=f.id===curFid&&!curSFid;
      return'<div class="move-fi'+(isCur?' sel':'')+'" data-fid="'+f.id+'" data-sfid="" style="padding-left:'+(12+depth*16)+'px'+(isCur?';opacity:.45;pointer-events:none':'')+'">'+'<span style="font-size:14px">'+(f.icon||'&#128193;')+'</span>'+'<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(f.name)+(isCur?' (current)':'')+'</span></div>'+buildTree(f.id,depth+1)+buildSubFolders(f.id,depth+1);
    }).join('');
  }
  function buildSubFolders(fid,depth){
    var out='';
    if(type==='doc'){
      out+=DF.filter(df=>df.folderId===fid).map(df=>{
        var isCur=df.folderId===curFid&&df.id===curDFid;
        return'<div class="move-fi'+(isCur?' sel':'')+'" data-fid="'+df.folderId+'" data-sfid="'+df.id+'" data-sftype="doc" style="padding-left:'+(12+depth*16)+'px'+(isCur?';opacity:.45;pointer-events:none':'')+'">'+'<span style="font-size:14px">&#128193;</span>'+'<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#534AB7">'+esc(df.name)+(isCur?' (current)':'')+'</span><span style="font-size:10px;color:#9CA3AF;margin-left:4px">doc folder</span></div>';
      }).join('');
    }
    if(type==='mom'){
      out+=MF.filter(mf=>mf.folderId===fid).map(mf=>{
        var isCur=mf.folderId===curFid&&mf.id===curMFid;
        return'<div class="move-fi'+(isCur?' sel':'')+'" data-fid="'+mf.folderId+'" data-sfid="'+mf.id+'" data-sftype="mom" style="padding-left:'+(12+depth*16)+'px'+(isCur?';opacity:.45;pointer-events:none':'')+'">'+'<span style="font-size:14px">&#128193;</span>'+'<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#534AB7">'+esc(mf.name)+(isCur?' (current)':'')+'</span><span style="font-size:10px;color:#9CA3AF;margin-left:4px">MoM folder</span></div>';
      }).join('');
    }
    return out;
  }
  var curSFlabel=curSFid?((type==='doc'?(DF.find(v=>v.id===curSFid)||{}):(MF.find(v=>v.id===curSFid)||{})).name||'subfolder'):'';
  var tree=buildTree(null,0);
  modal('<div class="m-title">&#128194; Move to Folder</div><div class="m-sub">Choose destination for <strong>'+esc(item.name||item.title||'this item')+'</strong><br><small style="color:#9CA3AF">Currently in: '+esc(folderLabel(curFid))+(curSFid?(', '+esc(curSFlabel)):'')+'</small></div><div id="mv-list" style="display:flex;flex-direction:column;gap:2px;max-height:340px;overflow-y:auto;border:1px solid #EAECF0;border-radius:8px;padding:6px">'+(tree||'<div style="padding:20px;text-align:center;color:#9CA3AF;font-size:13px">No other folders.</div>')+'</div><div class="m-foot"><button class="btn se" id="mv-c">Cancel</button><button class="btn pr" id="mv-ok" disabled>Move Here</button></div>');
  var sel=null,selSf=null,selSfType=null;
  document.getElementById('mv-c').addEventListener('click',closeModal);
  document.getElementById('mv-list').querySelectorAll('.move-fi:not([style*="pointer-events:none"])').forEach(el=>{
    el.addEventListener('click',()=>{document.getElementById('mv-list').querySelectorAll('.move-fi').forEach(e=>e.classList.remove('sel'));el.classList.add('sel');sel=el.dataset.fid;selSf=el.dataset.sfid||null;selSfType=el.dataset.sftype||null;document.getElementById('mv-ok').disabled=false;});
  });
  document.getElementById('mv-ok').addEventListener('click',()=>{
    if(!sel)return;
    if(type==='mom'){var m=M.find(v=>v.id===itemId);if(m){m.folderId=sel;if(selSf&&selSfType==='mom')m.momFolderId=selSf;else delete m.momFolderId;sM(m);}}
    else{var d=D.find(v=>v.id===itemId);if(d){d.folderId=sel;if(selSf&&selSfType==='doc')d.docFolderId=selSf;else delete d.docFolderId;sD(d);}}
    var sfLabel=selSf?((selSfType==='doc'?(DF.find(v=>v.id===selSf)||{}):(MF.find(v=>v.id===selSf)||{})).name||''):'';
    closeModal();toast('Moved to '+folderLabel(sel)+(sfLabel?', '+sfLabel:''));
  });
}
// DOC FOLDER MANAGEMENT
function openNewDocFolder(fid){
  modal('<div class="m-title">New Doc Folder</div><div class="fr"><label>Name</label><input type="text" id="dfn" placeholder="e.g. Contracts, Reports..."></div><div class="m-foot"><button class="btn se" id="ndf-c">Cancel</button><button class="btn pr" id="ndf-s">Create</button></div>');
  document.getElementById('ndf-c').addEventListener('click',closeModal);
  document.getElementById('ndf-s').addEventListener('click',()=>{var n=document.getElementById('dfn').value.trim();if(!n){alert('Please enter a name.');return;}sDF({id:uid(),folderId:fid,name:n,created:Date.now()});closeModal();toast('Doc folder created.');});
}
function openRenameDocFolder(id){
  var df=DF.find(v=>v.id===id);if(!df)return;
  modal('<div class="m-title">Rename Doc Folder</div><div class="fr"><label>Name</label><input type="text" id="rdf-n" value="'+esc(df.name)+'"></div><div class="m-foot"><button class="btn se" id="rdf-c">Cancel</button><button class="btn pr" id="rdf-s">Save</button></div>');
  document.getElementById('rdf-c').addEventListener('click',closeModal);
  document.getElementById('rdf-s').addEventListener('click',()=>{var n=document.getElementById('rdf-n').value.trim();if(!n)return;df.name=n;sDF(df);closeModal();toast('Renamed.');});
}
function askDeleteDocFolder(id){
  var df=DF.find(v=>v.id===id);var dc=docsOfDF(id).length;
  modal('<div class="m-title">Delete "'+esc(df?df.name:'')+'"?</div><div class="dz"><p>This will delete the folder'+(dc?' and ungroup '+dc+' document'+(dc!==1?'s':'')+' (they stay in the parent workspace folder)':'')+'. Cannot be undone.</p><div style="display:flex;gap:8px"><button class="btn se" id="ddf-c">Cancel</button><button class="btn da" id="ddf-d">Delete</button></div></div>');
  document.getElementById('ddf-c').addEventListener('click',closeModal);
  document.getElementById('ddf-d').addEventListener('click',()=>{docsOfDF(id).forEach(d=>{delete d.docFolderId;sD(d);});dDF(id);closeModal();toast('Doc folder deleted.');});
}
// MOM FOLDER MANAGEMENT
function openNewMomFolder(fid){
  modal('<div class="m-title">New MoM Folder</div><div class="fr"><label>Name</label><input type="text" id="mfn" placeholder="e.g. Q1 Reviews, Client Calls..."></div><div class="m-foot"><button class="btn se" id="nmf-c">Cancel</button><button class="btn pr" id="nmf-s">Create</button></div>');
  document.getElementById('nmf-c').addEventListener('click',closeModal);
  document.getElementById('nmf-s').addEventListener('click',()=>{var n=document.getElementById('mfn').value.trim();if(!n){alert('Please enter a name.');return;}sMF({id:uid(),folderId:fid,name:n,created:Date.now()});closeModal();toast('MoM folder created.');});
}
function openRenameMomFolder(id){
  var mf=MF.find(v=>v.id===id);if(!mf)return;
  modal('<div class="m-title">Rename MoM Folder</div><div class="fr"><label>Name</label><input type="text" id="rmf-n" value="'+esc(mf.name)+'"></div><div class="m-foot"><button class="btn se" id="rmf-c">Cancel</button><button class="btn pr" id="rmf-s">Save</button></div>');
  document.getElementById('rmf-c').addEventListener('click',closeModal);
  document.getElementById('rmf-s').addEventListener('click',()=>{var n=document.getElementById('rmf-n').value.trim();if(!n)return;mf.name=n;sMF(mf);closeModal();toast('Renamed.');});
}
function askDeleteMomFolder(id){
  var mf=MF.find(v=>v.id===id);var mc=momsOfMF(id).length;
  modal('<div class="m-title">Delete "'+esc(mf?mf.name:'')+'"?</div><div class="dz"><p>This will delete the folder'+(mc?' and ungroup '+mc+' MoM'+(mc!==1?'s':'')+' (they stay in the parent workspace folder)':'')+'. Cannot be undone.</p><div style="display:flex;gap:8px"><button class="btn se" id="dmf-c">Cancel</button><button class="btn da" id="dmf-d">Delete</button></div></div>');
  document.getElementById('dmf-c').addEventListener('click',closeModal);
  document.getElementById('dmf-d').addEventListener('click',()=>{momsOfMF(id).forEach(m=>{delete m.momFolderId;sM(m);});dMF(id);closeModal();toast('MoM folder deleted.');});
}
// RENAME DOC
function openRenameDoc(id){
  var d=D.find(v=>v.id===id);if(!d)return;
  modal('<div class="m-title">&#9999; Rename Document</div><div class="fr"><label>Name</label><input type="text" id="rd-n" value="'+esc(d.name)+'"></div><div class="m-foot"><button class="btn se" id="rd-c">Cancel</button><button class="btn pr" id="rd-s">Save</button></div>');
  document.getElementById('rd-c').addEventListener('click',closeModal);
  document.getElementById('rd-s').addEventListener('click',()=>{var n=document.getElementById('rd-n').value.trim();if(!n)return;d.name=n;sD(d);closeModal();toast('Renamed.');});
}
// DOWNLOAD
async function downloadFile(url,name){
  try{toast('Downloading...');var res=await fetch(url);if(!res.ok)throw new Error('Failed');var blob=await res.blob();var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name||'download';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);}
  catch(e){window.open(url,'_blank');}
}
// DOCS
function openAddDoc(){
  var f=cf();if(!f)return;var fid=f.id;
  modal('<div class="m-title">Add Document</div><div style="display:flex;gap:8px;margin-bottom:16px"><button class="btn pr sm" id="tab-up-btn">&#8679; Upload File</button><button class="btn se sm" id="tab-lk-btn">&#128279; Add Link</button></div>'+
    '<div id="tab-up"><div class="fr"><label>Name <span style="font-weight:400;color:#9CA3AF">(optional)</span></label><input type="text" id="dn-up" placeholder="Uses filename if blank"></div><div class="upload-zone" id="dz"><div class="upload-zone-icon">&#128193;</div><div class="upload-zone-text">Click to choose or drag &amp; drop</div><div class="upload-zone-sub">Images, PDFs, videos, docs — any file up to 100MB</div><div class="upload-prog" id="uprog"><div class="upload-prog-bar" id="upbar"></div></div></div><input type="file" id="fi" style="display:none"><div id="up-status" style="font-size:12px;color:#6B7280;margin-top:8px;min-height:18px"></div><div class="fr" style="margin-top:12px"><label>Note <span style="font-weight:400;color:#9CA3AF">(optional)</span></label><input type="text" id="dnote-up" placeholder="e.g. Sent to client May 15"></div><div class="m-foot"><button class="btn se" id="up-c">Cancel</button><button class="btn pr" id="up-s" disabled>Save</button></div></div>'+
    '<div id="tab-lk" style="display:none"><div class="fr"><label>Name</label><input type="text" id="dn-lk" placeholder="e.g. Q2 Proposal, Canva Deck"></div><div class="fr"><label>Type</label><select id="dt-lk"><option value="link">Link / URL</option><option value="presentation">Presentation</option><option value="pdf">PDF / Document</option><option value="spreadsheet">Spreadsheet</option><option value="image">Image</option><option value="other">Other</option></select></div><div class="fr"><label>URL</label><input type="url" id="du-lk" placeholder="https://..."></div><div class="fr"><label>Note <span style="font-weight:400;color:#9CA3AF">(optional)</span></label><input type="text" id="dno-lk" placeholder="e.g. Sent to client May 15"></div><div class="m-foot"><button class="btn se" id="lk-c">Cancel</button><button class="btn pr" id="lk-s">Save</button></div></div>',true);
  window._uploadData=null;
  document.getElementById('tab-up-btn').addEventListener('click',()=>{document.getElementById('tab-up').style.display='';document.getElementById('tab-lk').style.display='none';document.getElementById('tab-up-btn').className='btn pr sm';document.getElementById('tab-lk-btn').className='btn se sm';});
  document.getElementById('tab-lk-btn').addEventListener('click',()=>{document.getElementById('tab-lk').style.display='';document.getElementById('tab-up').style.display='none';document.getElementById('tab-lk-btn').className='btn pr sm';document.getElementById('tab-up-btn').className='btn se sm';});
  document.getElementById('up-c').addEventListener('click',closeModal);document.getElementById('lk-c').addEventListener('click',closeModal);
  var dz=document.getElementById('dz');
  dz.addEventListener('click',()=>document.getElementById('fi').click());
  dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('drag');});
  dz.addEventListener('dragleave',()=>dz.classList.remove('drag'));
  dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('drag');if(e.dataTransfer.files[0])doUpload(e.dataTransfer.files[0]);});
  document.getElementById('fi').addEventListener('change',e=>{if(e.target.files[0])doUpload(e.target.files[0]);});
  async function doUpload(file){
    var st=document.getElementById('up-status'),pg=document.getElementById('uprog'),bar=document.getElementById('upbar'),sb=document.getElementById('up-s'),tx=dz.querySelector('.upload-zone-text');
    st.textContent='Uploading '+file.name+'...';pg.style.display='block';sb.disabled=true;
    try{var r=await uploadCL(file,p=>{bar.style.width=p+'%';});window._uploadData={...r,origName:file.name};st.innerHTML='<span style="color:#059669">&#10003; '+esc(file.name)+' ready</span>';if(tx)tx.textContent='Ready: '+file.name;sb.disabled=false;}
    catch(err){st.innerHTML='<span style="color:#DC2626">'+(err.message||'Upload failed. Try again.')+'</span>';pg.style.display='none';console.error(err);}
  }
  document.getElementById('up-s').addEventListener('click',()=>{var fd=window._uploadData;if(!fd){alert('Please select a file first.');return;}var ne=document.getElementById('dn-up'),no=document.getElementById('dnote-up');var docObj={id:uid(),folderId:fid,name:(ne&&ne.value.trim())||fd.origName||'File',cloudType:fd.cloudType,format:fd.format,url:fd.url,note:(no&&no.value.trim())||'',added:Date.now(),uploaded:true,type:fd.cloudType||'other',starred:false};if(DOC_FOLDER)docObj.docFolderId=DOC_FOLDER;sD(docObj);window._uploadData=null;closeModal();if(!DOC_FOLDER)setTab('doc');else renderMain();});
  document.getElementById('lk-s').addEventListener('click',()=>{var n=document.getElementById('dn-lk').value.trim();if(!n){alert('Please enter a name.');return;}var docObj={id:uid(),folderId:fid,name:n,type:document.getElementById('dt-lk').value||'other',url:document.getElementById('du-lk').value.trim(),note:document.getElementById('dno-lk').value.trim(),added:Date.now(),starred:false};if(DOC_FOLDER)docObj.docFolderId=DOC_FOLDER;sD(docObj);closeModal();if(!DOC_FOLDER)setTab('doc');else renderMain();});
}
function relockDoc(id){UD.delete(id);renderMain();}
// FOLDERS
var EMOJIS=['📁','🏢','🍱','📈','👥','🚀','💼','🎯','📋','🌿','⚡','🔑','💡','🗂️','🛒','🏗️','🎨','📊','🧪','🤝','📱','💰','🖥️','📣'];
function emRow(sel){return'<div class="er">'+EMOJIS.map(e=>'<span class="eo'+(e===sel?' on':'')+'" data-em="'+e+'">'+e+'</span>').join('')+'</div>';}
function bindEmoji(c){c.querySelectorAll('.eo').forEach(el=>el.addEventListener('click',()=>{c.querySelectorAll('.eo').forEach(e=>e.classList.remove('on'));el.classList.add('on');}));}
function getSelEmoji(c){return(c.querySelector('.eo.on')||{}).textContent||'📁';}
function openNewFolder(pid){
  var pn=pid?(gf(pid)||{}).name:null;
  modal('<div class="m-title">New folder'+(pn?' <span style="font-size:12px;color:#9CA3AF;font-weight:400">under '+esc(pn)+'</span>':'')+  '</div><div class="nf-lbl" style="margin-top:20px">Name</div><div class="fr"><input class="lk-pw" type="text" id="fn" placeholder="e.g. Clients, Product Roadmap..."></div><div class="nf-lbl">Icon</div><div class="fr" style="margin-bottom:0">'+emRow('📁')+'</div><div class="m-foot"><button class="btn se" id="nf-c">Cancel</button><button class="btn dk" id="nf-s">Create folder</button></div>');
  var mr=document.getElementById('MR');bindEmoji(mr);
  document.getElementById('nf-c').addEventListener('click',closeModal);
  document.getElementById('nf-s').addEventListener('click',()=>{var n=document.getElementById('fn').value.trim();if(!n){alert('Please enter a name.');return;}sF({id:uid(),name:n,icon:getSelEmoji(mr),parent:pid||null,created:Date.now()});if(pid)EXP.add(pid);saveExp();closeModal();});
}
function openRename(id){
  var f=gf(id);if(!f)return;
  modal('<div class="m-title">Rename folder</div><div class="nf-lbl" style="margin-top:20px">Name</div><div class="fr"><input class="lk-pw" type="text" id="rn" value="'+esc(f.name)+'"></div><div class="nf-lbl">Icon</div><div class="fr" style="margin-bottom:0">'+emRow(f.icon||'📁')+'</div><div class="m-foot"><button class="btn se" id="rn-c">Cancel</button><button class="btn dk" id="rn-s">Save</button></div>');
  var mr=document.getElementById('MR');bindEmoji(mr);
  document.getElementById('rn-c').addEventListener('click',closeModal);
  document.getElementById('rn-s').addEventListener('click',()=>{var n=document.getElementById('rn').value.trim();if(!n)return;f.name=n;f.icon=getSelEmoji(mr);sF(f);closeModal();});
}
function askDeleteFolder(id){
  var f=gf(id),tot=cnt(id);
  modal('<div class="m-title">Delete "'+esc(f?f.name:'')+'"?</div><div class="dz"><p>This will permanently delete this folder'+(tot>0?' and all '+tot+' item'+(tot!==1?'s':'')+' inside':'')+'. Cannot be undone.</p><div style="display:flex;gap:8px"><button class="btn se" id="df-c">Cancel</button><button class="btn da" id="df-d">Yes, Delete</button></div></div>');
  document.getElementById('df-c').addEventListener('click',closeModal);
  document.getElementById('df-d').addEventListener('click',()=>{var f2=gf(id),par=f2?f2.parent:null;dFDeep(id);closeModal();par?goTo(pathTo(par)):goHome();});
}
function relock(id){UF.delete(id);if(PATH.includes(id))goHome();else render();}
// LOCK
function openLockModal(type,id){
  var item=type==='folder'?gf(id):D.find(d=>d.id===id);if(!item)return;var has=!!item.pw;
  modal('<div class="m-title">'+(has?'Change / Remove Lock':'Set a Password Lock')+'</div><div class="m-sub">This '+type+' will require a password to open.</div>'+(has?'<div class="fr"><label>Current Password</label><input type="password" id="lc"><div class="e-msg" id="lce">Wrong password.</div></div>':'')+'<div class="fr"><label>New Password</label><input type="password" id="ln" placeholder="Choose a password"></div><div class="fr"><label>Confirm</label><input type="password" id="lf" placeholder="Confirm password"><div class="e-msg" id="lfe">Passwords do not match.</div></div><div class="m-foot" style="justify-content:space-between">'+(has?'<button class="btn da sm" id="lk-rm">Remove Lock</button>':'<div></div>')+'<div style="display:flex;gap:8px"><button class="btn se" id="lk-c">Cancel</button><button class="btn pr" id="lk-s">Set Lock</button></div></div>',true);
  document.getElementById('lk-c').addEventListener('click',closeModal);
  if(has)document.getElementById('lk-rm').addEventListener('click',async()=>{var cu=document.getElementById('lc'),ce=document.getElementById('lce');var it=type==='folder'?gf(id):D.find(d=>d.id===id);if(cu&&(await hw(cu.value))!==it.pw){ce.classList.add('on');cu.classList.add('err');return;}if(type==='folder'){var f=gf(id);if(f){delete f.pw;sF(f);}UF.delete(id);}else{var d=D.find(v=>v.id===id);if(d){delete d.pw;sD(d);}UD.delete(id);}closeModal();toast('Lock removed.');});
  document.getElementById('lk-s').addEventListener('click',async()=>{var nw=document.getElementById('ln').value,c2=document.getElementById('lf').value;var fe=document.getElementById('lfe'),cu=document.getElementById('lc'),ce=document.getElementById('lce');if(ce)ce.classList.remove('on');if(fe)fe.classList.remove('on');if(!nw){document.getElementById('ln').classList.add('err');return;}if(nw!==c2){fe.classList.add('on');document.getElementById('lf').classList.add('err');return;}if(has&&cu){var it=type==='folder'?gf(id):D.find(d=>d.id===id);if((await hw(cu.value))!==it.pw){ce.classList.add('on');cu.classList.add('err');return;}}var h=await hw(nw);if(type==='folder'){var f=gf(id);if(f){f.pw=h;sF(f);UF.add(id);}}else{var d=D.find(v=>v.id===id);if(d){d.pw=h;sD(d);UD.add(id);}}closeModal();toast('Lock set!');});
}
// UNLOCK
function unlockFolder(lid,dest){
  var f=gf(lid);window._dest=dest;
  var lkSvg='<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
  modal('<div class="lk-sc"><div class="lk-icon-wrap">'+lkSvg+'</div><div class="lk-title">'+esc(f?f.name:'')+'</div><div class="lk-sub">This folder is password protected.</div></div><div class="fr"><input class="lk-pw" type="password" id="up2" placeholder="Enter password"><div class="e-msg" id="ue">Wrong password. Try again.</div></div><div style="display:flex;gap:8px;margin-top:16px"><button class="btn se" style="flex:1;justify-content:center" id="uf-c">Cancel</button><button class="btn dk" style="flex:1;justify-content:center" id="uf-ok">Unlock</button></div>');
  document.getElementById('uf-c').addEventListener('click',closeModal);
  var inp=document.getElementById('up2');inp.focus();inp.addEventListener('keydown',e=>{if(e.key==='Enter')doUF(lid);});document.getElementById('uf-ok').addEventListener('click',()=>doUF(lid));
}
async function doUF(id){var f=gf(id),pw=document.getElementById('up2').value||'';if((await hw(pw))===f.pw||await imp(pw)){UF.add(id);closeModal();var d=window._dest;window._dest=null;if(d)goTo(d);}else{document.getElementById('ue').classList.add('on');var i=document.getElementById('up2');i.classList.add('err');i.value='';i.focus();}}
function unlockDoc(id){
  var d=D.find(v=>v.id===id);
  var lkSvg='<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
  modal('<div class="lk-sc"><div class="lk-icon-wrap">'+lkSvg+'</div><div class="lk-title">'+esc(d?d.name:'')+'</div><div class="lk-sub">This document is password protected.</div></div><div class="fr"><input class="lk-pw" type="password" id="udp" placeholder="Enter password"><div class="e-msg" id="ude">Wrong password.</div></div><div style="display:flex;gap:8px;margin-top:16px"><button class="btn se" style="flex:1;justify-content:center" id="ud-c">Cancel</button><button class="btn dk" style="flex:1;justify-content:center" id="ud-ok">Unlock</button></div>');
  document.getElementById('ud-c').addEventListener('click',closeModal);
  var inp=document.getElementById('udp');inp.focus();inp.addEventListener('keydown',e=>{if(e.key==='Enter')doUD(id);});document.getElementById('ud-ok').addEventListener('click',()=>doUD(id));
}
async function doUD(id){var d=D.find(v=>v.id===id),pw=document.getElementById('udp').value||'';if((await hw(pw))===d.pw||await imp(pw)){UD.add(id);closeModal();renderMain();}else{document.getElementById('ude').classList.add('on');var i=document.getElementById('udp');i.classList.add('err');i.value='';i.focus();}}
// LIGHTBOX
function openLightbox(url,name){var ov=document.createElement('div');ov.className='lb-ov';var img=document.createElement('img');img.src=url;img.alt=name||'';var cls=document.createElement('button');cls.className='lb-close';cls.innerHTML='&#10005;';var nm=document.createElement('div');nm.className='lb-name';nm.textContent=name||'';ov.appendChild(img);ov.appendChild(cls);ov.appendChild(nm);document.body.appendChild(ov);function closeLB(){ov.remove();document.removeEventListener('keydown',onKey);}function onKey(e){if(e.key==='Escape')closeLB();}ov.addEventListener('click',e=>{if(e.target===ov)closeLB();});cls.addEventListener('click',closeLB);document.addEventListener('keydown',onKey);}
// MODAL
function modal(html,wide){var r=document.getElementById('MR');r.innerHTML='<div class="ov" id="OV"><div class="modal'+(wide?' w':'')+'">'+html+'</div></div>';document.getElementById('OV').addEventListener('click',e=>{if(e.target.id==='OV')closeModal();});setTimeout(()=>{var i=r.querySelector('input[type=text],input[type=password]');if(i)i.focus();},50);}
function closeModal(){document.getElementById('MR').innerHTML='';}
function toast(msg){var t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),300);},2200);}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();closeCtx();}if((e.metaKey||e.ctrlKey)&&e.key==='s'&&VIEW==='mom'){e.preventDefault();saveMom();}});
document.getElementById('btn-new-folder').addEventListener('click',()=>openNewFolder(null));
var _sbToggle=()=>{document.getElementById('sidebar').classList.toggle('collapsed');};
document.getElementById('sb-toggle').addEventListener('click',_sbToggle);
document.getElementById('sb-close').addEventListener('click',_sbToggle);
document.getElementById('nav-home').addEventListener('click',goHome);
loadExp();
if(window.innerWidth<=700)document.getElementById('sidebar').classList.add('collapsed');
