/* TRANSMISSION · Personal listening, 2026.
   "Para ahora" is our own recent-affinity ordering of Spotify-authorized data,
   NOT Spotify's restricted recommendation algorithm. */
(async function(){
'use strict';
const sp=window.TransmissionSpotify;
const el=id=>document.getElementById(id);
if(!sp||!el('tm-liked-grid'))return;
const owner=sp.CONFIG.ownerId;
const art=u=>typeof u==='string'&&/^https:\/\/(i\.scdn\.co|mosaic\.scdn\.co|image-cdn-ak\.spotifycdn\.com|seeded-session-images\.scdn\.co)\//.test(u)?u:'';
const image=t=>art(t?.album?.images?.[0]?.url||t?.image);
const artists=t=>(t?.artists||[]).map(a=>a.name).filter(Boolean).join(', ')||t?.artist||'';
const create=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e};
const valid=t=>t&&/^[A-Za-z0-9]{22}$/.test(t.id)&&t.name;
const asTrack=t=>valid(t)?{...t,uri:t.uri||'spotify:track:'+t.id,artists:t.artists||[{name:t.artist||'Artista'}]}:null;
const unique=items=>{
 const ids=new Set(),out=[];
 for(const item of items||[]){
   const t=asTrack(item);
   if(!t||ids.has(t.id))continue;
   ids.add(t.id);out.push(t)
 }
 return out;
};
let liked=[],likesTotal=0,canFetchMore=false,visible=12,loading=false;
let recentEvents=[],ownerTop=[],rt=null,ownerConnected=false,accountReady=false;
const likedGrid=el('tm-liked-grid'),more=el('tm-liked-more'),play=el('tm-liked-play'),label=el('liked-kicker');
function status(message,error=false){rt?.status(message,error)}
function render(){
 likedGrid.replaceChildren();
 const active=unique(liked);
 if(!active.length){
   likedGrid.append(create('p','tm-liked-empty',ownerConnected?'Spotify no devolvió canciones guardadas.':'La selección de favoritas aún no está publicada.'));
 }else{
   for(const t of active.slice(0,visible)){
     const card=create('article','tm-liked-card');
     const cover=create('button','tm-liked-art');
     cover.type='button';cover.setAttribute('aria-label','Reproducir '+t.name);cover.title=t.name;
     if(image(t))cover.style.backgroundImage='url("'+image(t)+'")';
     cover.onclick=()=>void rt?.playTrack(t);
     const meta=create('div','tm-liked-caption');
     meta.append(create('strong','',t.name),create('small','',artists(t)));
     card.append(cover,meta);likedGrid.append(card);
   }
 }
 label.textContent=active.length?'FAVORITAS':'ARCHIVO';
 play.disabled=!active.length;
 more.hidden=!(active.length>visible||ownerConnected&&canFetchMore);
 el('collection-count-3').textContent=active.length?(likesTotal||active.length)+' '+((likesTotal||active.length)===1?'CANCIÓN':'CANCIONES')+' ↗':'';
 if(!ownerConnected && rt?.publicSnapshot?.status==='ready' && !active.length){
   label.textContent='SELECCIÓN PÚBLICA';
 }
}
function fillPlaylistRail(){
 if(!rt||rt.playlists?.length)return;
 const source=unique(liked.length?liked:(rt.ownerTracks?.length?rt.ownerTracks:rt.publicSnapshot?.tracks||[]));
 if(!source.length)return;
 const rail=el('mixtapes'),anchor=el('rail-all');
 if(!rail||!anchor)return;
 rail.querySelectorAll('.rail-item').forEach(x=>x.remove());
 const heading=rail.querySelector('.rail-heading');
 if(heading)heading.textContent='FAVORITAS';
 for(const track of source.slice(0,4)){
   const button=create('button','rail-item');
   button.type='button';button.title=track.name;
   const cover=create('span','rail-item-cover tm-rail-image');
   if(image(track))cover.style.backgroundImage='url("'+image(track)+'")';
   const label=create('span','rail-item-label');
   label.append(document.createTextNode(track.name),create('small','',artists(track)));
   button.append(cover,label,create('span','rail-item-arrow','▶'));
   button.onclick=()=>void rt.playTrack(track);
   rail.insertBefore(button,anchor);
 }
}

async function loadFirst(){
 if(ownerConnected){
   try{
     const data=await sp.api('/me/tracks?limit=50&offset=0');
     liked=(data.items||[]).map(x=>x.track).filter(valid);
     likesTotal=Number(data.total)||liked.length;
     canFetchMore=!!data.next&&liked.length<likesTotal;
   }catch(e){status('No pude leer tus Me gusta: '+e.message,true)}
 }else{
   liked=(rt?.publicSnapshot?.liked||[]).filter(valid);
   likesTotal=liked.length;
 }
 render();
 rt?.fillEmptyHome?.(liked);
 fillPlaylistRail();
 const holder=el('recent-items');
 if(ownerConnected && liked.length && holder && !holder.querySelector('button')){
   // Another section can fall back to saved songs, without inventing play history.
   el('recent-label').textContent='DEL ARCHIVO';
   holder.replaceChildren();
   for(const track of liked.slice(0,5)){
     const btn=create('button','tm-recent-item');
     const cover=create('span','tm-recent-cover');if(image(track))cover.style.backgroundImage='url("'+image(track)+'")';
     const by=create('span','tm-recent-desc');
     by.append(create('strong','',track.name),create('small','',artists(track)));
     btn.append(cover,by,create('span','tm-recent-arrow','▶'));
     btn.onclick=()=>void rt.playTrack(asTrack(track));holder.append(btn);
   }
 }
}
async function loadNext(){
 if(loading)return;
 loading=true;more.disabled=true;
 try{
   if(ownerConnected&&canFetchMore&&visible+12>liked.length){
     const data=await sp.api('/me/tracks?limit=50&offset='+liked.length);
     const seen=new Set(liked.map(t=>t.id));
     for(const row of data.items||[]){
       const t=row.track;if(valid(t)&&!seen.has(t.id)){liked.push(t);seen.add(t.id)}
     }
     canFetchMore=!!data.next&&liked.length<(Number(data.total)||liked.length);
   }
   visible+=12;
 }catch(e){status('No se pudieron cargar más favoritas: '+e.message,true)}
 finally{loading=false;more.disabled=false;render()}
}
function recentWeight(entries){
 const score=new Map();
 function add(raw,value){
   const t=asTrack(raw);if(!t||!Number.isFinite(value))return;
   const item=score.get(t.id)||{track:t,score:0};
   item.score+=value;score.set(t.id,item);
 }
 if(ownerConnected){
   recentEvents.slice(0,50).forEach((x,i)=>add(x.track,Math.max(6,115-i*2.3)));
   ownerTop.slice(0,30).forEach((t,i)=>add(t,Math.max(9,80-i*2.3)));
   liked.slice(0,100).forEach((t,i)=>add(t,Math.max(5,24-i*.25)));
 }else{
   (rt?.publicSnapshot?.recent||[]).slice(0,20).forEach((t,i)=>add(t,Math.max(8,105-i*4.5)));
   (rt?.publicSnapshot?.tracks||[]).slice(0,30).forEach((t,i)=>add(t,Math.max(8,72-i*2)));
   liked.slice(0,40).forEach((t,i)=>add(t,Math.max(5,22-i*.3)));
 }
 let ranked=[...score.values()].sort((a,b)=>b.score-a.score).map(x=>x.track);
 // Avoid neighbouring repeats of an artist or album without randomising on every reload.
 const result=[];
 while(ranked.length&&result.length<40){
   const last=result.slice(-2);
   let idx=ranked.findIndex(t=>last.every(prev=>{
     const sameArtist=artists(prev)&&artists(prev)===artists(t);
     const sameAlbum=prev.album?.id&&prev.album.id===t.album?.id;
     return !sameArtist&&!sameAlbum;
   }));
   if(idx<0)idx=0;
   result.push(ranked.splice(idx,1)[0]);
 }
 return result;
}
async function startSongs(tracks){
 const playlist=unique(tracks).slice(0,40);
 if(!playlist.length){status('Todavía no hay suficientes canciones en la selección.',true);return}
 const first=playlist[0];
 if(!rt?.account){
   await rt?.playTrack(first);return
 }
 rt.player?.activateElement?.();
 const result=await rt.action(async()=>{
   await rt.activatePlayer();
   await sp.api('/me/player/play?device_id='+encodeURIComponent(rt.device),{
     method:'PUT',body:JSON.stringify({uris:playlist.map(t=>t.uri)})
   });
 });
 if(result!==true && result!==undefined){
   await rt.playTrack(first);
 }
}
let discoveryCache=null,discoveryTime=0;
async function lightDiscovery(known){
 if(!rt?.account)return [];
 if(discoveryCache&&Date.now()-discoveryTime<1200000)return discoveryCache;
 const names=ownerConnected?
   unique([...recentEvents.map(e=>e.track),...ownerTop]).slice(0,15).flatMap(t=>(t.artists||[]).map(x=>x.name)):
   (rt.publicSnapshot?.artists||[]).map(a=>a.name);
 const picked=[...new Set(names.filter(Boolean))].slice(0,2);
 const inCollection=new Set([...known,...liked].map(t=>t.id));
 const found=[];
 for(const name of picked){
   try{
     const q=new URLSearchParams({q:'artist:"'+name.replace(/"/g,'')+'"',type:'track',limit:'10'});
     const data=await sp.api('/search?'+q.toString());
     for(const song of data?.tracks?.items||[]){
       if(!valid(song)||inCollection.has(song.id))continue;
       if(!(song.artists||[]).some(a=>a.name?.toLocaleLowerCase()===name.toLocaleLowerCase()))continue;
       found.push(song);inCollection.add(song.id);
       if(found.length>=8)break
     }
   }catch(e){console.warn('Discovery search unavailable:',e.message)}
 }
 discoveryCache=found;discoveryTime=Date.now();
 return found;
}
async function playNow(){
 const button=el('tm-now-play'),caption=el('tm-now-caption');
 const songs=recentWeight(recentEvents);
 if(!songs.length){status('La selección reciente aún no tiene canciones.',true);return}
 button.disabled=true;
 const original=caption.textContent;
 caption.textContent='Buscando canciones afines…';
 try{
   // Spotify Search supplies artist catalog tracks, not personalized Recommendation API results.
   const discoveries=await lightDiscovery(songs);
   const queue=[];
   for(let i=0;i<songs.length;i++){
     queue.push(songs[i]);
     if((i+1)%4===0 && discoveries.length)queue.push(discoveries.shift());
   }
   await startSongs(queue);
 }finally{
   button.disabled=false;caption.textContent=original;
 }
}
async function playLiked(){await startSongs(liked)}
async function fetchRecent(){
 if(!ownerConnected)return;
 if(rt.recent?.length){
   recentEvents=rt.recent.filter(valid).map(track=>({track}));
   return;
 }
 // If the main player could not read history, retry just once.
 try{
   const data=await sp.api('/me/player/recently-played?limit=50');
   recentEvents=(data.items||[]).filter(x=>valid(x.track));
 }catch(e){console.warn('Recent affinity not available:',e.message)}
}
async function prepare(){
 for(let i=0;i<38;i++){
   rt=window.TransmissionRuntime;
   if(rt?.ready)break;
   await new Promise(done=>setTimeout(done,300));
 }
 if(!rt)return;
 ownerConnected=rt.account?.id===owner;
 accountReady=!!rt.account;
 if(ownerConnected){
   ownerTop=rt.ownerTracks||[];
   // Reuse the already-loaded top tracks instead of doubling API requests.
 }
 await Promise.allSettled([loadFirst(),fetchRecent()]);
 const hasRecent=ownerConnected?recentEvents.length:rt.publicSnapshot?.recent?.length||0;
 el('tm-now-caption').textContent=hasRecent?'Lo que más escuchas últimamente':'Basada en tu colección';
}
el('tm-now-play').onclick=()=>void playNow();
play.onclick=()=>void playLiked();
more.onclick=()=>void loadNext();
window.TransmissionTaste={
 getOwnerLiked:()=>ownerConnected?unique(liked).slice(0,40):[],
 getPublicLiked:()=>unique(liked).slice(0,40),
 getNowSongs:()=>recentWeight(recentEvents),
 getLiked:()=>unique(liked)
};
await prepare();
})();