// Data layer: MoM content conversion (legacy Quill Delta → HTML, previews, the prospect-journal
// column). Uses detached elements for parsing only. momPreview expects the page to provide esc().
function momDeltaToHTML(content){
  if(!content)return'<p style="color:#9CA3AF">No content.</p>';
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
function momPreview(c){if(!c)return'No content yet...';try{var d=JSON.parse(c);if(d&&Array.isArray(d.ops)){var t=d.ops.map(o=>typeof o.insert==='string'?o.insert:'').join('').replace(/\n/g,' ').trim();return esc(t.substring(0,140)+(t.length>140?'...':''));}}catch(e){}var tmp=document.createElement('div');tmp.innerHTML=c;var t2=(tmp.textContent||tmp.innerText||'').replace(/\s+/g,' ').trim();return esc(t2.substring(0,140)+(t2.length>140?'...':''));}
function isProspectJournal(m){return!!m&&String(m.title||'').trim().toLowerCase()==='clients - prospect journal';}
function remarkHeaderText(cell){return String(cell&&cell.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();}
function remarkColumnIndex(table){
  var row=table&&table.querySelector('tr');if(!row)return-1;
  var cells=Array.from(row.children);
  for(var i=0;i<cells.length;i++)if(remarkHeaderText(cells[i])==='detailed remarks')return i;
  return-1;
}
function addDetailedRemarksColumn(html){
  if(!html)return{html:html,added:false};
  var wrap=document.createElement('div');wrap.innerHTML=html;
  var tables=Array.from(wrap.querySelectorAll('table'));
  for(var ti=0;ti<tables.length;ti++){
    var table=tables[ti],rows=Array.from(table.querySelectorAll('tr'));
    if(!rows.length||remarkColumnIndex(table)!==-1)continue;
    var header=document.createElement('th');header.textContent='Detailed Remarks';rows[0].appendChild(header);
    for(var ri=1;ri<rows.length;ri++){var cell=document.createElement('td');cell.innerHTML='<p></p>';rows[ri].appendChild(cell);}
    return{html:wrap.innerHTML,added:true};
  }
  return{html:html,added:false};
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
