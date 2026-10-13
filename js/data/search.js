// Data layer: workspace search matching. q is already lower-cased. No DOM.
function searchWorkspace(q2){
  var folders=F.filter(f=>f.name.toLowerCase().includes(q2));
  var moms=M.filter(m=>(m.title||'').toLowerCase().includes(q2)||momPreview(m.content).toLowerCase().includes(q2));
  var docs=D.filter(d=>(d.name||'').toLowerCase().includes(q2)||(d.note||'').toLowerCase().includes(q2));
  return{folders:folders,moms:moms,docs:docs};
}
