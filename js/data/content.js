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
