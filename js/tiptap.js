import{Editor}from'https://esm.sh/@tiptap/core@2';
import StarterKit from'https://esm.sh/@tiptap/starter-kit@2';
import Table from'https://esm.sh/@tiptap/extension-table@2';
import TableRow from'https://esm.sh/@tiptap/extension-table-row@2';
import TableHeader from'https://esm.sh/@tiptap/extension-table-header@2';
import TableCell from'https://esm.sh/@tiptap/extension-table-cell@2';
import Underline from'https://esm.sh/@tiptap/extension-underline@2';
import Link from'https://esm.sh/@tiptap/extension-link@2';
import TextStyle from'https://esm.sh/@tiptap/extension-text-style@2';
import Color from'https://esm.sh/@tiptap/extension-color@2';
import Highlight from'https://esm.sh/@tiptap/extension-highlight@2';
import FontFamily from'https://esm.sh/@tiptap/extension-font-family@2';
import TextAlign from'https://esm.sh/@tiptap/extension-text-align@2';
import{BubbleMenu}from'https://esm.sh/@tiptap/extension-bubble-menu@2';
import{Extension,Node,mergeAttributes}from'https://esm.sh/@tiptap/core@2';
import Image from'https://esm.sh/@tiptap/extension-image@2';
const FontSize=Extension.create({name:'fontSize',addOptions(){return{types:['textStyle']}},addGlobalAttributes(){return[{types:this.options.types,attributes:{fontSize:{default:null,parseHTML:el=>el.style.fontSize||null,renderHTML:attrs=>{if(!attrs.fontSize)return{};return{style:'font-size:'+attrs.fontSize}}}}}]},addCommands(){return{setFontSize:s=>({chain:c})=>c().setMark('textStyle',{fontSize:s}).run(),unsetFontSize:()=>({chain:c})=>c().setMark('textStyle',{fontSize:null}).removeEmptyTextStyle().run()}}});
const ResizableImage=Image.extend({name:'image',addAttributes(){return{...this.parent?.(),width:{default:null,parseHTML:el=>el.style.width||el.getAttribute('width')||null,renderHTML:()=>({})},px:{default:null,parseHTML:el=>el.getAttribute('data-px')!=null?Number(el.getAttribute('data-px')):null,renderHTML:attrs=>attrs.px!=null?{'data-px':attrs.px}:{}},py:{default:null,parseHTML:el=>el.getAttribute('data-py')!=null?Number(el.getAttribute('data-py')):null,renderHTML:attrs=>attrs.py!=null?{'data-py':attrs.py}:{}}}},renderHTML({HTMLAttributes,node}){const attrs={src:node.attrs.src||''};if(node.attrs.width)attrs.style='width:'+node.attrs.width;if(node.attrs.px!=null){attrs['data-px']=node.attrs.px;attrs['data-py']=node.attrs.py;}return['img',mergeAttributes(attrs,HTMLAttributes)]},addNodeView(){return({node:initNode,getPos,editor})=>{
  // mutable copy — updated in update() so closures always read fresh values
  let A={...initNode.attrs};
  function tt(){return document.getElementById('tiptap-editor')&&document.getElementById('tiptap-editor').querySelector('.tiptap');}
  function setFloating(px,py){wrap.classList.remove('tt-img-inline');wrap.style.position='absolute';wrap.style.left=px+'px';wrap.style.top=py+'px';}
  function setInline(){wrap.classList.add('tt-img-inline');wrap.style.position='';wrap.style.left='';wrap.style.top='';}
  function saveAttrs(extra){if(typeof getPos==='function')editor.commands.command(({tr})=>{tr.setNodeMarkup(getPos(),null,{...A,...extra});return true;});}
  const wrap=document.createElement('span');
  wrap.className='tt-img-wrap'+(initNode.attrs.px!=null?'':' tt-img-inline');
  if(initNode.attrs.px!=null)setFloating(initNode.attrs.px,initNode.attrs.py);
  // toolbar
  const tb=document.createElement('div');tb.className='tt-img-toolbar';
  const floatBtn=document.createElement('button');floatBtn.className='tt-img-tb-btn';
  function updateFloatBtn(){floatBtn.textContent=A.px!=null?'📌 Pin to text':'✋ Float (drag freely)';}
  updateFloatBtn();
  function bindFloatBtn(e){e.preventDefault();e.stopPropagation();
    if(A.px!=null){// pin back to text
      setInline();saveAttrs({px:null,py:null});
    } else {// convert to floating at current visual position
      const t=tt();if(!t)return;
      const tr2=t.getBoundingClientRect();const wr=wrap.getBoundingClientRect();
      const nx=Math.round(wr.left-tr2.left);const ny=Math.round(wr.top-tr2.top+t.scrollTop);
      setFloating(nx,ny);saveAttrs({px:nx,py:ny});
    }
  }
  floatBtn.addEventListener('mousedown',bindFloatBtn);floatBtn.addEventListener('touchstart',bindFloatBtn,{passive:false});
  tb.appendChild(floatBtn);
  const sep=document.createElement('div');sep.className='tt-img-tb-sep';tb.appendChild(sep);
  const delBtn=document.createElement('button');delBtn.className='tt-img-tb-btn';delBtn.textContent='🗑 Remove';
  function bindDelBtn(e){e.preventDefault();e.stopPropagation();
    if(typeof getPos==='function'){const pos=getPos();editor.commands.command(({tr})=>{tr.delete(pos,pos+initNode.nodeSize);return true;});}
  }
  delBtn.addEventListener('mousedown',bindDelBtn);delBtn.addEventListener('touchstart',bindDelBtn,{passive:false});
  tb.appendChild(delBtn);wrap.appendChild(tb);
  // image
  const img=document.createElement('img');img.src=initNode.attrs.src;img.alt=initNode.attrs.alt||'';
  img.style.cssText='display:block;border-radius:4px;pointer-events:none;'+(initNode.attrs.width?'width:'+initNode.attrs.width:'max-width:100%');
  wrap.appendChild(img);
  // resize handle (bottom-right)
  const rh=document.createElement('div');rh.className='tt-rsz-handle se';
  function bindRhDrag(e){e.preventDefault();e.stopPropagation();
    const startX=(e.touches?e.touches[0]:e).clientX,startW=img.offsetWidth;
    const onMove=ev=>{const cx=(ev.touches?ev.touches[0]:ev).clientX;const w=Math.max(40,startW+(cx-startX))+'px';img.style.width=w;saveAttrs({width:w});};
    const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);document.removeEventListener('touchmove',onMove);document.removeEventListener('touchend',onUp);};
    document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
    document.addEventListener('touchmove',onMove,{passive:false});document.addEventListener('touchend',onUp);
  }
  rh.addEventListener('mousedown',bindRhDrag);rh.addEventListener('touchstart',bindRhDrag,{passive:false});
  wrap.appendChild(rh);
  // click/tap to select; drag only works when floating
  function startWrapDrag(e){
    if(tb.contains(e.target)||e.target===rh)return;
    const isTouch=!!e.touches;
    if(!wrap.classList.contains('selected')){
      if(!isTouch)e.stopPropagation();
      document.querySelectorAll('.tt-img-wrap.selected').forEach(w=>{if(w!==wrap)w.classList.remove('selected');});
      wrap.classList.add('selected');
      return;
    }
    if(A.px==null)return;
    e.preventDefault();e.stopPropagation();
    const t=tt();if(!t)return;
    const startLeft=parseFloat(wrap.style.left)||0;
    const startTop=parseFloat(wrap.style.top)||0;
    const pt=isTouch?e.touches[0]:e;
    const startX=pt.clientX,startY=pt.clientY;
    wrap.style.cursor='grabbing';
    const onMove=ev=>{
      const t2=tt();if(!t2)return;
      const cp=ev.touches?ev.touches[0]:ev;
      const dx=cp.clientX-startX;const dy=cp.clientY-startY;
      const maxX=t2.clientWidth-wrap.offsetWidth;
      const maxY=t2.scrollHeight-wrap.offsetHeight;
      wrap.style.left=Math.max(0,Math.min(maxX,startLeft+dx))+'px';
      wrap.style.top=Math.max(0,Math.min(maxY,startTop+dy))+'px';
    };
    const onUp=ev=>{
      document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);
      document.removeEventListener('touchmove',onMove);document.removeEventListener('touchend',onUp);
      wrap.style.cursor='grab';
      const t2=tt();if(!t2)return;
      const cp=ev.changedTouches?ev.changedTouches[0]:ev;
      const dx=cp.clientX-startX;const dy=cp.clientY-startY;
      const maxX=t2.clientWidth-wrap.offsetWidth;const maxY=t2.scrollHeight-wrap.offsetHeight;
      saveAttrs({px:Math.round(Math.max(0,Math.min(maxX,startLeft+dx))),py:Math.round(Math.max(0,Math.min(maxY,startTop+dy)))});
    };
    document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
    document.addEventListener('touchmove',onMove,{passive:false});document.addEventListener('touchend',onUp);
  }
  wrap.addEventListener('mousedown',startWrapDrag);
  wrap.addEventListener('touchstart',startWrapDrag,{passive:false});
  document.addEventListener('click',ev=>{if(!wrap.contains(ev.target))wrap.classList.remove('selected');},{capture:true,passive:true});
  return{dom:wrap,update(n){
    if(n.type.name!=='image')return false;
    A={...n.attrs};
    img.src=n.attrs.src;
    if(n.attrs.width)img.style.width=n.attrs.width;
    if(n.attrs.px!=null)setFloating(n.attrs.px,n.attrs.py);else setInline();
    updateFloatBtn();
    return true;
  }};
}}});
window._TT={Editor,StarterKit,Table,TableRow,TableHeader,TableCell,Underline,Link,TextStyle,Color,Highlight,FontFamily,TextAlign,FontSize,BubbleMenu,ResizableImage};
