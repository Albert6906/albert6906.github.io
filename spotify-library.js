(function(){
'use strict';
const sp=window.TransmissionSpotify,rt=window.TransmissionRuntime;
if(!sp||!rt)return;
const el=id=>document.getElementById(id);
const shell=el('tm-library-screen'),grid=el('tm-library-grid'),more=el('tm-library-more');
const search=el('tm-library-search'),feedback=el('tm-library-feedback');
if(!shell||!grid||!more)return;
let items=[],offset=0,total=0,next=false,loading=false,mode='all',focusBefore=null;
const good=p=>p?.id&&p.id.length===22&&/^[A-Za-z0-9]+$/.test(p.id);
const isRadio=p=>/radio|mix|descubr|discover|radar|repeat|daylist/i.test(p.name||'');
const make=(tag,cls,txt)=>{const node=document.createElement(tag);node.className=cls;if(txt!==undefined)node.textContent=txt;return node};
function add(batch){
 const seen=new Set(items.map(p=>p.id));
 for(const p of batch||[])if(good(p)&&!seen.has(p.id)){items.push(p);seen.add(p.id)}
}
function render(){
 grid.replaceChildren();
 const query=search.value.trim().toLowerCase();
 let subset=items.filter(p=>(mode!=='radios'||isRadio(p))&&(!query||(p.name||'').toLowerCase().includes(query)));
 for(const p of subset){
   const card=make('button','tm-library-card');card.type='button';
   const cover=make('span','tm-library-art');
   const img=p.images?.[0]?.url||'';
   if(img.startsWith('https://i.scdn.co/')||img.startsWith('https://mosaic.scdn.co/'))cover.style.backgroundImage='url("'+img+'")';
   else cover.textContent='♫';
   card.append(cover,make('strong','',p.name||'Playlist'),make('small','',p.items?.total!=null?p.items.total+' CANCIONES':'LISTA'));
   card.onclick=()=>{close();void rt.playPlaylist({...p,uri:p.uri||'spotify:playlist:'+p.id})};
   grid.append(card)
 }
 if(!subset.length)grid.append(make('p','tm-liked-empty',items.length?'No hay coincidencias.':'Todavía no hay listas visibles.'));
 el('tm-library-count').textContent=items.length+(total>items.length?' / '+total:'')+' LISTAS';
 more.hidden=!next;more.disabled=loading;
}
function open(e){
 focusBefore=e?.currentTarget||document.activeElement;
 if(!items.length){add(rt.playlists||[]);offset=items.length;total=items.length;next=!!rt.account&&rt.account.id===rt.owner&&items.length>=20}
 shell.hidden=false;shell.setAttribute('aria-hidden','false');search.focus();render();
}
function close(){
 shell.hidden=true;shell.setAttribute('aria-hidden','true');focusBefore?.focus?.();
}
async function loadMore(){
 if(loading||!next||rt.account?.id!==rt.owner)return;
 loading=true;more.disabled=true;feedback.textContent='Cargando listas…';
 try{
   const response=await sp.api('/me/playlists?limit=50&offset='+offset);
   const batch=response.items||[];add(batch);
   offset+=batch.length;total=Math.max(items.length,Number(response.total)||0);
   next=!!response.next&&batch.length>0&&offset<total;
   feedback.textContent='';
 }catch(e){feedback.textContent='No se pudieron cargar otras listas. Consulta Diagnóstico.';rt.status(e.message,true)}
 finally{loading=false;render()}
}
el('tm-library-close').onclick=close;
more.onclick=()=>void loadMore();
search.oninput=render;
shell.addEventListener('click',e=>{if(e.target===shell)close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!shell.hidden)close()});
document.querySelectorAll('.tm-library-filters button').forEach(b=>b.onclick=()=>{
 mode=b.dataset.filter||'all';
 document.querySelectorAll('.tm-library-filters button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
 render()
});
el('rail-all').onclick=open;el('collection-playlists').onclick=open;
document.querySelectorAll('a[href="#mixtapes"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();open(e)}));
window.TransmissionLibrary={open,close,sync(){add(rt.playlists||[]);offset=items.length;next=!!rt.account&&rt.account.id===rt.owner&&items.length>=20;render()},getAll:()=>[...items]};
})();