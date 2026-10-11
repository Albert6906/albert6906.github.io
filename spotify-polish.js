/* TRANSMISSION: animations respond to playback state, not to fabricated beats. */
(function(){
'use strict';
const rt=window.TransmissionRuntime;
if(!rt)return;
const owner=rt.owner;
let recentArtists=[];
function updateArtists(track){
 if(rt.account?.id!==owner||!track)return;
 const nodes=[];
 const known=new Set();
 const add=name=>{
   const text=String(name||'').trim();const key=text.toLocaleLowerCase();
   if(text&&!known.has(key)){known.add(key);nodes.push(text)}
 };
 (track.artists||[]).forEach(a=>add(a.name));
 for(const a of recentArtists)add(a);
 for(const a of rt.ownerArtists||[])add(a.name);
 recentArtists=nodes.slice(0,12);
 const container=document.getElementById('taste-artist-names');
 const block=document.getElementById('taste-artists');
 if(!container||!block)return;
 container.replaceChildren(...nodes.slice(0,6).map(name=>{
   const span=document.createElement('span');span.textContent=name;return span
 }));
 block.hidden=!container.childElementCount;
}
window.addEventListener('tm:owner-track',event=>updateArtists(event.detail?.track));
window.addEventListener('tm:playback',event=>{
 const p=event.detail||{};
 const playing=!!p.playing;
 document.body.classList.toggle('tm-is-playing',playing);
 const live=document.getElementById('live-label');
 if(live){
   const dot=live.querySelector('.pulse-dot');
   live.replaceChildren(document.createTextNode(playing?'SONANDO ':'ESCUCHAR '));
   if(dot)live.append(dot);
 }
 const heroStatus=document.querySelector('.hero-topline .hero-onair');
 if(heroStatus)heroStatus.hidden=!(playing&&rt.account?.id===owner);
});
})();