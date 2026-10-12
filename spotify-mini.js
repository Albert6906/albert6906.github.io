/* TRANSMISSION — compact player lower left, tied to the real Spotify SDK state. */
(function(){
'use strict';
const rt=window.TransmissionRuntime;
if(!rt)return;
const $=id=>document.getElementById(id);
const mini=$('tm-mini-player'),primary=$('player'),toggle=$('tm-mini-toggle');
const miniVolume=$('tm-mini-volume'),mainVolume=$('tm-volume'),stripVolume=$('tm-strip-volume');
const progress=$('tm-mini-seek'),mainProgress=$('tm-seek');
let miniSeeking=false;
if(!mini||!primary)return;
let actualTrack=null,playing=false,mainVisible=true;
const shapes={
 play:'<path d="m9 5 12 7-12 7V5Z" fill="currentColor" stroke="none"/>',
 pause:'<rect x="7" y="5" width="3.5" height="14" rx=".6" fill="currentColor" stroke="none"/><rect x="14" y="5" width="3.5" height="14" rx=".6" fill="currentColor" stroke="none"/>'
};
const icon=name=>'<svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8">'+shapes[name]+'</svg>';
function show(){
 mini.hidden=!actualTrack||!rt.account;
 toggle.innerHTML=icon(playing?'pause':'play');
 toggle.setAttribute('aria-label',playing?'Pausar':'Reproducir');
}
function updateTrack(track){
 if(!track?.id)return;
 actualTrack=track;
 $('tm-mini-title').textContent=track.name||'';
 $('tm-mini-artist').textContent=(track.artists||[]).map(a=>a.name).join(', ');
 const cover=track.album?.images?.[0]?.url||'';
 $('tm-mini-cover').style.backgroundImage=cover.startsWith('https://i.scdn.co/')?'url("'+cover+'")':'none';
 show()
}
window.addEventListener('tm:track',e=>updateTrack(e.detail?.track));
window.addEventListener('tm:playback',e=>{
 playing=!!e.detail?.playing;
 const state=rt.state;
 if(state?.volume!=null){miniVolume.value=state.volume;if(stripVolume)stripVolume.value=state.volume}
 else if(mainVolume){miniVolume.value=mainVolume.value;if(stripVolume)stripVolume.value=mainVolume.value}
 if(progress)progress.disabled=!rt.state?.duration;
 show()
});
toggle.onclick=()=>{if($('tm-play'))$('tm-play').click()};
function changeVolume(value){
 if(!mainVolume)return;
 mainVolume.value=value;
 miniVolume.value=value;
 if(stripVolume)stripVolume.value=value;
 mainVolume.dispatchEvent(new Event('input',{bubbles:true}));
}
miniVolume.addEventListener('input',()=>changeVolume(miniVolume.value));
stripVolume?.addEventListener('input',()=>changeVolume(stripVolume.value));
if(typeof IntersectionObserver!=='undefined'){
 const observer=new IntersectionObserver(entries=>{
   mainVisible=entries[0]?.isIntersecting!==false;
   show()
 },{threshold:0});
 observer.observe(primary);
}else{
 const check=()=>{const r=primary.getBoundingClientRect();mainVisible=r.bottom>0&&r.top<window.innerHeight;show()};
 window.addEventListener('scroll',check,{passive:true});window.addEventListener('resize',check);check()
}
if(progress&&mainProgress){
 progress.addEventListener('pointerdown',()=>{miniSeeking=true});
 progress.addEventListener('input',()=>{
   miniSeeking=true;
   const duration=rt.state?.duration||0;
   $('tm-mini-elapsed').textContent=formatTime(Number(progress.value)/1000*duration);
 });
 progress.addEventListener('change',()=>{
   miniSeeking=false;
   mainProgress.value=progress.value;
   mainProgress.dispatchEvent(new Event('change',{bubbles:true}));
 });
}
function formatTime(ms){
 const s=Math.floor(Math.max(0,Number(ms)||0)/1000);
 return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')
}
setInterval(()=>{
 const state=rt.state;
 if(!state?.duration||!actualTrack)return;
 const max=state.duration;
 $('tm-mini-duration').textContent=formatTime(max);
 if(!miniSeeking){
   if(mainProgress?.value)progress.value=mainProgress.value;
   $('tm-mini-elapsed').textContent=$('tm-elapsed')?.textContent||formatTime(state.position||0);
 }
},1000);
if(rt.state?.playing&&rt.currentTrack?.id)updateTrack(rt.currentTrack);
})();
