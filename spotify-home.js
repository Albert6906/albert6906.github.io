/* TRANSMISSION / HOME FEATURED ROTATION. Owner signed-in data and public snapshots. */
(async()=>{
'use strict';
const sp=window.TransmissionSpotify;
const main=document.getElementById('main');
if(!main||!sp)return;
let spotlight=null;
function render(info,label){
  if(!info?.name||!info?.artist||!info?.image)return;
  if(!/^https:\/\/(i\.scdn\.co|mosaic\.scdn\.co|image-cdn-ak\.spotifycdn\.com|seeded-session-images\.scdn\.co)\//.test(info.image))return;
  if(!spotlight){
    const st=document.createElement('style');
    st.textContent=".tm-feature{border-top:1px solid #5c5c5c;border-bottom:1px solid #515151;display:grid;grid-template-columns:minmax(0,1fr) minmax(180px,29%);background:#141414;color:#f5f5f0;min-height:250px;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif}\n.tm-feature-copy{padding:23px 27px;display:flex;flex-direction:column;gap:13px;justify-content:space-between;min-width:0}\n.tm-feature .tm-eyebrow{color:#e6ff60;font:10px/1.5 'DM Mono',monospace;letter-spacing:.08em}\n.tm-feature h2{margin:0;text-transform:uppercase;font-weight:900;font-style:italic;letter-spacing:-.045em;font-size:clamp(36px,5vw,85px);line-height:.89;overflow-wrap:anywhere}\n.tm-feature .tm-byline{color:#aaa;font:12px/1.7 'DM Mono',monospace}\n.tm-feature .tm-link{align-self:flex-start;color:#0b0b0b;background:#e6ff60;padding:11px 18px;font-size:17px;font-weight:900}\n.tm-feature .tm-link:hover{background:#fff}\n.tm-feature .tm-art{display:block;position:relative;overflow:hidden;min-height:240px;background:repeating-linear-gradient(-30deg,#303422 0 20px,#131712 20px 40px);border-left:1px solid #555}\n.tm-feature .tm-art img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}\n.tm-feature .tm-art-label{position:absolute;right:10px;bottom:9px;background:#e6ff60;color:#000;padding:6px 8px;font:10px 'DM Mono',monospace}\n@media(max-width:720px){.tm-feature{grid-template-columns:1fr 33%;min-height:150px}.tm-feature-copy{padding:16px}.tm-feature .tm-art{min-height:170px}.tm-feature h2{font-size:clamp(28px,5.5vw,55px)}}\n@media(max-width:420px){.tm-feature{grid-template-columns:1fr 37%}.tm-feature .tm-eyebrow{font-size:8px}.tm-feature h2{font-size:33px}.tm-feature .tm-byline{font-size:9px}.tm-feature .tm-link{font-size:14px;padding:8px 10px}}";
    document.head.appendChild(st);
    spotlight=document.createElement('section');spotlight.className='tm-feature';
    spotlight.setAttribute('aria-label','Mi música destacada');
    const anchor=main.querySelector('.lead-layout')||main.firstElementChild;
    anchor?.insertAdjacentElement('afterend',spotlight);
  }
  spotlight.replaceChildren();
  const copy=document.createElement('div');copy.className='tm-feature-copy';
  const eyebrow=document.createElement('div');eyebrow.className='tm-eyebrow';eyebrow.textContent=label;
  const title=document.createElement('h2');title.textContent=info.name;
  const artist=document.createElement('div');artist.className='tm-byline';artist.textContent=info.artist;
  const link=document.createElement('a');link.className='tm-link';link.href='./musica.html';link.textContent='ESCUCHAR EN MI FRECUENCIA ↗';
  copy.append(eyebrow,title,artist,link);
  const art=document.createElement('div');art.className='tm-art';
  const img=document.createElement('img');img.alt='Carátula de '+info.name;img.loading='lazy';img.src=info.image;
  const sub=document.createElement('span');sub.className='tm-art-label';sub.textContent='MY ROTATION';
  art.append(img,sub);spotlight.append(copy,art);
}
try{
  const r=await fetch('./featured.json?cache='+Math.floor(Date.now()/3600000),{cache:'no-store'});
  if(r.ok){
    const publicData=await r.json();
    if(publicData?.track&&publicData?.status==='ready')render(publicData.track,'TRANSMISSION / ROTACIÓN DEL PROPIETARIO');
  }
}catch{}
if(!sp.isLogged())return;
try{
  const me=await sp.api('/me');
  if(me?.id!==sp.CONFIG.ownerId)return;
  const data=await sp.api('/me/top/tracks?time_range=short_term&limit=1');
  const t=data.items?.[0];
  if(t?.id)render({name:t.name,artist:(t.artists||[]).map(x=>x.name).join(', '),
    image:t.album?.images?.[0]?.url||'',id:t.id},'TU ROTACIÓN / ACTUALIZADO DESDE SPOTIFY');
}catch{}
})();