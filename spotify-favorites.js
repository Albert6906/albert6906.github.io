/* TRANSMISSION / Spotify library state. Uses the 2026 unified endpoints. */
(function(){
'use strict';
const sp=window.TransmissionSpotify,rt=window.TransmissionRuntime;
const main=document.getElementById('tm-favorite'),mini=document.getElementById('tm-mini-favorite');
if(!sp||!rt||!main||!mini)return;
let song=null,saved=null,serial=0,busy=false;
const valid=t=>t?.id&&/^[a-zA-Z0-9]{22}$/.test(t.id)&&t.type!=='episode';
const makeURI=t=>'spotify:track:'+t.id;
function draw(){
 for(const button of [main,mini]){
   button.disabled=!valid(song)||busy;
   button.textContent=saved===true?'♥':'♡';
   button.dataset.saved=String(saved===true);
   const description=saved===true?'Quitar de Me gusta':'Guardar en Me gusta';
   button.setAttribute('aria-label',description);
   button.title=description;
   button.setAttribute('aria-pressed',String(saved===true));
 }
}
async function inspect(track){
 const seq=++serial;
 song=valid(track)?track:null;saved=null;draw();
 if(!song||!rt.account)return;
 try{
   const data=await sp.api('/me/library/contains?uris='+encodeURIComponent(makeURI(song)));
   if(seq!==serial)return;
   saved=Array.isArray(data)?!!data[0]:false;
 }catch(error){
   if(seq!==serial)return;
   rt.status('Favoritos: '+error.message,true);
   // Leave the outlined heart so that checking is possible after reconnecting.
   saved=null;
 }finally{if(seq===serial)draw()}
}
async function toggle(){
 if(!song||busy)return;
 if(!rt.account){
   rt.status('Conecta tu Spotify para guardar canciones.',true);return
 }
 const id=song.id,uri=makeURI(song),before=saved===true;
 busy=true;draw();
 try{
   await sp.api('/me/library?uris='+encodeURIComponent(uri),{method:before?'DELETE':'PUT'});
   if(song?.id===id){
     saved=!before;
     document.dispatchEvent(new CustomEvent('tm:library-changed',{detail:{id,saved}}));
   }
 }catch(error){
   rt.status('Guardar canción: '+error.message,true);
 }finally{busy=false;draw()}
}
main.onclick=toggle;mini.onclick=toggle;
window.addEventListener('tm:track',e=>void inspect(e.detail?.track));
if(valid(rt.currentTrack))void inspect(rt.currentTrack);
draw();
window.TransmissionFavorites={get state(){return saved},inspect,toggle};
})();