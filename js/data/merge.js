// Data layer: three-way merge of MoM bodies (S2). Uses the DOM only to split HTML into blocks.
//
// A MoM body is a list of top-level blocks (paragraphs, headings, lists, tables, images). Given
// the version both sides started from (base), ours and theirs, mergeBodies() keeps every change:
// a part changed on one side only takes that side; a part changed the same way on both sides is
// kept once; a part changed differently on both sides keeps both versions, theirs first, then
// ours (it is a "conflict": nothing is dropped, the person tidies it). Lists merge item by item,
// so two people adding different points to the same list don't conflict.
//
// Returns { html, blocks: [{ html, ours: index of that block in ours, or -1 }], conflicts }.
// HTML is only parsed inside <template> elements, which are inert (no scripts, no loading); the
// result goes into the editor, whose schema drops anything it doesn't know.

// Top-level blocks of an HTML string, as their outer HTML.
function _blocksOf(html){
  var t=document.createElement('template');t.innerHTML=html||'';
  var out=[];
  t.content.childNodes.forEach(function(n){
    if(n.nodeType===1)out.push(n.outerHTML);
    else if(n.nodeType===3&&n.textContent.trim())out.push(n.textContent);   // stray text: keep it as a block
  });
  return out;
}

// Longest common subsequence of two string arrays, as matched index pairs. The common start and
// end are matched first, so the table only covers the changed middle.
function _lcs(a,b){
  var pre=0;while(pre<a.length&&pre<b.length&&a[pre]===b[pre])pre++;
  var suf=0;while(suf<a.length-pre&&suf<b.length-pre&&a[a.length-1-suf]===b[b.length-1-suf])suf++;
  var A=a.slice(pre,a.length-suf),B=b.slice(pre,b.length-suf),n=A.length,m=B.length;
  var L=[];for(var i=0;i<=n;i++){L.push(new Uint32Array(m+1));}
  for(i=n-1;i>=0;i--)for(var j=m-1;j>=0;j--)L[i][j]=A[i]===B[j]?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);
  var pairs=[];for(i=0;i<pre;i++)pairs.push([i,i]);
  i=0;j=0;
  while(i<n&&j<m){if(A[i]===B[j]){pairs.push([pre+i,pre+j]);i++;j++;}else if(L[i+1][j]>=L[i][j+1])i++;else j++;}
  for(i=0;i<suf;i++)pairs.push([a.length-suf+i,b.length-suf+i]);
  return pairs;
}

// If X is base with blocks added (base kept in order, as a subsequence): the added blocks before
// each base block and after the last, as { html, at: index in X }, and where each base block is in
// X. Otherwise null.
function _gaps(base,X){
  var gaps=[[]],at=[],i=0;
  for(var k=0;k<X.length;k++){
    if(i<base.length&&X[k]===base[i]){at.push(k);i++;gaps.push([]);}
    else gaps[gaps.length-1].push({html:X[k],at:k});
  }
  return i===base.length?{gaps:gaps,at:at}:null;
}
function _same(x,y){if(x.length!==y.length)return false;for(var i=0;i<x.length;i++)if(x[i]!==y[i])return false;return true;}

// The opening tag of a list, so two versions of "the same list" can be recognised.
function _listShell(html){
  var t=document.createElement('template');t.innerHTML=html;
  var el=t.content.firstElementChild;
  if(!el||!/^(UL|OL)$/.test(el.tagName))return null;
  return el.cloneNode(false).outerHTML;
}
function _listItems(html){
  var t=document.createElement('template');t.innerHTML=html;
  return Array.prototype.map.call(t.content.firstElementChild.children,function(c){return c.outerHTML;});
}

// diff3 over block arrays. Each output entry: { html, ours } (ours = index in `ours`, or -1).
function _merge3(base,ours,theirs,depth){
  var mo={},mt={};
  _lcs(base,ours).forEach(function(p){mo[p[0]]=p[1];});
  _lcs(base,theirs).forEach(function(p){mt[p[0]]=p[1];});
  var out=[],conflicts=0,o=0,a=0,b=0;
  function take(list,from,to,mine){for(var i=from;i<to;i++)out.push({html:list[i],ours:mine?i:-1});}
  // One block changed on both sides: a list merges item by item; otherwise both are kept.
  function one(Ob,Ab,Bb,ai){
    if(Ab===Ob){out.push({html:Bb,ours:ai});return;}   // theirs, in the place of your block (the caret stays in it)
    if(Bb===Ob||Ab===Bb){out.push({html:Ab,ours:ai});return;}
    if(depth===0){
      var sh=_listShell(Ob);
      if(sh&&sh===_listShell(Ab)&&sh===_listShell(Bb)){
        var inner=_merge3(_listItems(Ob),_listItems(Ab),_listItems(Bb),1);
        var t=document.createElement('template');t.innerHTML=Ab;
        var el=t.content.firstElementChild;el.innerHTML=inner.blocks.map(function(x){return x.html;}).join('');
        out.push({html:el.outerHTML,ours:ai});conflicts+=inner.conflicts;return;
      }
    }
    conflicts++;out.push({html:Bb,ours:-1});out.push({html:Ab,ours:ai});   // both kept: theirs, then ours
  }
  function chunk(o2,a2,b2){
    var O=base.slice(o,o2),A=ours.slice(a,a2),B=theirs.slice(b,b2);
    if(!A.length&&!B.length&&!O.length)return;
    if(_same(A,O)){   // only theirs changed; edited in place, each block stays linked to yours (the caret)
      if(A.length===B.length){for(var j=0;j<B.length;j++)out.push({html:B[j],ours:a+j});}else take(theirs,b,b2,false);
      return;
    }
    if(_same(B,O)||_same(A,B)){take(ours,a,a2,true);return;}   // only ours changed, or both the same way
    // Edits in place (the same number of blocks on all three sides): settle each block on its own,
    // so changes to neighbouring blocks don't conflict.
    if(O.length&&O.length===A.length&&O.length===B.length){for(var i=0;i<O.length;i++)one(O[i],A[i],B[i],a+i);return;}
    // One side only added blocks around the base; the other edited the base blocks in place:
    // apply both (an edit next to a colleague's new paragraph is not a conflict).
    var gB=_gaps(O,B);
    if(gB&&O.length===A.length){for(i=0;i<=O.length;i++){gB.gaps[i].forEach(function(x){out.push({html:x.html,ours:-1});});if(i<O.length)one(O[i],A[i],O[i],a+i);}return;}
    var gA=_gaps(O,A);
    if(gA&&O.length===B.length){for(i=0;i<=O.length;i++){gA.gaps[i].forEach(function(x){out.push({html:x.html,ours:a+x.at});});if(i<O.length)one(O[i],O[i],B[i],a+gA.at[i]);}return;}
    conflicts++;take(theirs,b,b2,false);take(ours,a,a2,true);   // both kept: theirs, then ours
  }
  while(true){
    var k=o;while(k<base.length&&!(k in mo&&k in mt&&mo[k]>=a&&mt[k]>=b))k++;
    if(k>=base.length){chunk(base.length,ours.length,theirs.length);break;}
    if(k===o&&mo[k]===a&&mt[k]===b){out.push({html:ours[a],ours:a});o++;a++;b++;continue;}
    chunk(k,mo[k],mt[k]);o=k;a=mo[k];b=mt[k];
  }
  return{blocks:out,conflicts:conflicts};
}

function mergeBodies(baseHTML,oursHTML,theirsHTML){
  if(oursHTML===theirsHTML){var same=_blocksOf(oursHTML);return{html:oursHTML,blocks:same.map(function(h,i){return{html:h,ours:i};}),conflicts:0};}
  var r=_merge3(_blocksOf(baseHTML),_blocksOf(oursHTML),_blocksOf(theirsHTML),0);
  return{html:r.blocks.map(function(x){return x.html;}).join(''),blocks:r.blocks,conflicts:r.conflicts};
}
