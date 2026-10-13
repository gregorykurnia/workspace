// Data layer: workspace search matching. q is already lower-cased. No DOM.
function searchWorkspace(q2){
  var folders=F.filter(f=>f.name.toLowerCase().includes(q2));
  var moms=M.filter(m=>(m.title||'').toLowerCase().includes(q2)||momPreview(m.content).toLowerCase().includes(q2));
  var docs=D.filter(d=>(d.name||'').toLowerCase().includes(q2)||(d.note||'').toLowerCase().includes(q2));
  return{folders:folders,moms:moms,docs:docs};
}

// Search for the new UI: only what this viewer may see. Areas match by name (a restricted area
// shows its name and nothing inside it); MoMs by title or text; files by name or note. Anything
// inside a restricted area, and locked files, never appear. Newest MoMs and files first.
function searchAll(q,limit){
  var t=(q||'').trim().toLowerCase(),max=limit||6;
  if(!t)return{areas:[],moms:[],files:[]};
  var has=function(s){return(s||'').toLowerCase().indexOf(t)>-1;};
  // A restricted area shows by name; areas inside it do not (nothing inside it appears).
  var areas=visibleAreas().filter(function(a){var lk=lockedArea(a.id);return has(a.name)&&(!lk||lk.id===a.id);}).sort(function(a,b){return(a.name||'').localeCompare(b.name||'');}).slice(0,max);
  var moms=M.filter(function(m){return!hiddenItem('m',m)&&(has(m.title)||plainText(m.content,m.id).toLowerCase().indexOf(t)>-1);})
    .sort(function(a,b){return(Number(b.date)||0)-(Number(a.date)||0);}).slice(0,max);
  var files=D.filter(function(d){return!hiddenItem('f',d)&&(has(d.name)||has(d.note));})
    .sort(function(a,b){return docAddedValue(b)-docAddedValue(a);}).slice(0,max);
  return{areas:areas,moms:moms,files:files};
}
