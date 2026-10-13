// Data layer: MoM content conversion (legacy Quill Delta → HTML, the prospect-journal column),
// and the filter for notes shown without the editor. Uses detached elements for parsing only.
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
function isProspectJournal(m){return!!m&&String(m.title||'').trim().toLowerCase()==='clients - prospect journal';}
function remarkHeaderText(cell){return String(cell&&cell.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();}
function remarkColumnIndex(table){
  var row=table&&table.querySelector('tr');if(!row)return-1;
  var cells=Array.from(row.children);
  for(var i=0;i<cells.length;i++)if(remarkHeaderText(cells[i])==='detailed remarks')return i;
  return-1;
}
// ---------- New editor (Phase 4): legacy content and the Long text model ----------
// Quill is loaded only when a note still holds an old Quill Delta (W11). The rest of the app
// never needs it.
var _quillLoad=null;
function loadQuill(){
  if(typeof Quill!=='undefined')return Promise.resolve();
  if(_quillLoad)return _quillLoad;
  _quillLoad=new Promise(function(res,rej){
    var s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.min.js';
    s.integrity='sha384-QUJ+ckWz1M+a7w0UfG1sEn4pPrbQwSxGm/1TIPyioqXBrwuT9l4f9gdHWLDLbVWI';
    s.crossOrigin='anonymous';
    s.addEventListener('load',function(){res();});
    s.addEventListener('error',function(){_quillLoad=null;rej(new Error('quill-unavailable'));});
    document.head.appendChild(s);
  });
  return _quillLoad;
}
function isDeltaContent(content){if(!content||content.charAt(0)!=='{')return false;try{var d=JSON.parse(content);return!!(d&&Array.isArray(d.ops));}catch(e){return false;}}
// Stored content → HTML the editor can open. Rejects (never resolves to '') when an old note
// can't be converted, so the editor can't open it empty and save over it.
function toEditorHTML(content){
  if(!content)return Promise.resolve({html:'',legacy:false});
  if(!isDeltaContent(content))return Promise.resolve({html:content,legacy:false});
  return loadQuill().then(function(){return{html:deltaToHTML(content),legacy:true};});
}

// The Long text model (plan 2.8): a Long text column is marked on its heading cell with
// data-coltype="longtext"; a prospect journal table carries data-template="prospect-journal".
var JOURNAL_TEMPLATE='prospect-journal';
// Mark the journal table of a "Clients - Prospect Journal" MoM: its "Detailed Remarks" column
// becomes Long text and the table becomes a journal. A journal with no such column gets one, as
// the old app did. Works on an inert parsed copy (nothing in the note can run or load), changes
// attributes only, and is idempotent. Returns { html, changed }.
function journalize(html){
  if(!html)return{html:html,changed:false};
  var doc=new DOMParser().parseFromString('<!doctype html><html><body>'+html+'</body></html>','text/html');
  var body=doc.body,changed=false,target=null,col=-1;
  var tables=Array.from(body.querySelectorAll('table'));
  for(var i=0;i<tables.length&&!target;i++){var c=remarkColumnIndex(tables[i]);if(c>-1){target=tables[i];col=c;}}
  if(!target){
    for(var j=0;j<tables.length&&!target;j++){
      var rows=Array.from(tables[j].querySelectorAll('tr'));
      if(!rows.length)continue;
      var th=doc.createElement('th');var p=doc.createElement('p');p.textContent='Detailed Remarks';th.appendChild(p);rows[0].appendChild(th);
      for(var r=1;r<rows.length;r++){var td=doc.createElement('td');td.appendChild(doc.createElement('p'));rows[r].appendChild(td);}
      target=tables[j];col=rows[0].children.length-1;changed=true;
    }
  }
  if(!target)return{html:html,changed:false};
  if(target.getAttribute('data-template')!==JOURNAL_TEMPLATE){target.setAttribute('data-template',JOURNAL_TEMPLATE);changed=true;}
  var head=target.querySelector('tr').children[col];
  if(head&&head.getAttribute('data-coltype')!=='longtext'){head.setAttribute('data-coltype','longtext');changed=true;}
  return{html:changed?body.innerHTML:html,changed:changed};
}

// The plain text of a stored note (HTML or old Quill Delta), with no markup. Parsed in an inert
// document, and remembered per MoM until its content changes.
var _plainCache=new Map();
function plainText(content,cacheKey){
  if(!content)return'';
  var hit=cacheKey&&_plainCache.get(cacheKey);
  if(hit&&hit.c===content)return hit.t;
  var t;
  if(content.charAt(0)==='{'&&isDeltaContent(content)){
    t=JSON.parse(content).ops.map(function(o){return typeof o.insert==='string'?o.insert:' ';}).join('');
  }else{
    var d=new DOMParser().parseFromString('<!doctype html><body>'+content,'text/html');
    d.querySelectorAll('script,style,template,noscript').forEach(function(n){n.remove();});
    d.querySelectorAll('br,p,div,li,tr,td,th,h1,h2,h3,h4,blockquote').forEach(function(n){n.append(' ');});
    t=d.body.textContent||'';
  }
  t=t.replace(/\s+/g,' ').trim();
  if(cacheKey)_plainCache.set(cacheKey,{c:content,t:t});
  return t;
}

// ---------- Notes shown without the editor (guest view, A4 export) ----------
// The editor filters a note through its schema; these views show the stored HTML directly, so it
// is filtered here first: only the tags, attributes, classes and style properties real notes use
// (checked against every MoM in the workspace). Works on an inert parsed copy; nothing in the
// note can run or load while it is filtered. opts.momHref(id) turns a link to another MoM into an
// address (return '' to show it as plain text); without it such links are plain text.
var NOTE_TAGS='p br h1 h2 h3 h4 h5 h6 strong b em i u s del strike mark code pre blockquote hr ul ol li a img table thead tbody tfoot tr th td colgroup col span div sub sup'.split(' ');
var NOTE_DROP='script style iframe frame frameset object embed template noscript form svg math link meta base title head audio video source'.split(' ');
var NOTE_STYLE=['min-width','color','font-family','font-size','text-align','width','background-color'];
var NOTE_ATTRS={a:['href'],img:['src','alt','data-px','data-py'],table:['data-template'],th:['colspan','rowspan','colwidth','data-coltype'],td:['colspan','rowspan','colwidth'],ol:['start'],ul:['data-checked'],li:['data-list','data-checked']};
function _noteStyle(v){
  return String(v||'').split(';').map(function(p){
    var i=p.indexOf(':');if(i<1)return'';
    var k=p.slice(0,i).trim().toLowerCase(),val=p.slice(i+1).trim();
    if(NOTE_STYLE.indexOf(k)<0||!val)return'';
    if(/url\s*\(|expression|javascript|@import|[\\{}<>]/i.test(val))return'';
    return k+':'+val;
  }).filter(Boolean).join(';');
}
function safeNoteHTML(html,opts){
  opts=opts||{};
  if(!html)return'';
  var doc=new DOMParser().parseFromString('<!doctype html><html><body>'+html+'</body></html>','text/html');
  (function walk(parent){
    Array.from(parent.childNodes).forEach(function(node){
      if(node.nodeType===3)return;
      if(node.nodeType!==1){node.remove();return;}
      var tag=node.tagName.toLowerCase();
      if(NOTE_DROP.indexOf(tag)>=0){node.remove();return;}
      if(NOTE_TAGS.indexOf(tag)<0){walk(node);while(node.firstChild)parent.insertBefore(node.firstChild,node);node.remove();return;}
      var allowed=NOTE_ATTRS[tag]||[];
      Array.from(node.attributes).forEach(function(a){
        var n=a.name.toLowerCase(),v=a.value,keep=false;
        if(n==='style'){v=_noteStyle(v);if(v){node.setAttribute('style',v);keep=true;}}
        else if(n==='class'){v=v.split(/\s+/).filter(function(c){return/^ql-[a-z0-9-]+$/.test(c)||c==='journal';}).join(' ');if(v){node.setAttribute('class',v);keep=true;}}
        else if(n==='colspan'||n==='rowspan'||n==='start'||n==='data-px'||n==='data-py'){keep=allowed.indexOf(n)>=0&&/^-?\d{1,6}$/.test(v);}
        else if(n==='colwidth'){keep=/^\d{1,5}(,\d{1,5})*$/.test(v);}
        else if(n==='href'&&tag==='a'){keep=/^(https?:|mailto:|tel:)/i.test(v.trim());}
        else if(n==='src'&&tag==='img'){keep=/^https:\/\//i.test(v.trim())||/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+\/=]+$/i.test(v.trim());}
        else keep=allowed.indexOf(n)>=0&&n!=='href'&&n!=='src';
        if(!keep)node.removeAttribute(a.name);
      });
      if(tag==='a'){
        var href=node.getAttribute('href')||'',m=/^https:\/\/mom\.local\/([^/?#]+)/i.exec(href);
        if(m){
          var to=opts.momHref?opts.momHref(decodeURIComponent(m[1])):'';
          if(to){node.setAttribute('href',to);node.removeAttribute('target');node.removeAttribute('rel');}
          else{var sp=doc.createElement('span');while(node.firstChild)sp.appendChild(node.firstChild);parent.replaceChild(sp,node);walk(sp);return;}
        }else if(href){node.setAttribute('target','_blank');node.setAttribute('rel','noopener noreferrer');}
        else{while(node.firstChild)parent.insertBefore(node.firstChild,node);node.remove();return;}
      }
      walk(node);
    });
  })(doc.body);
  return doc.body.innerHTML;
}
