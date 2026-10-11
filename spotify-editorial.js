/* TRANSMISSION / original editorial layout with actual Spotify tracks, playlists and player.
   Uses Spotify's official OAuth PKCE client and Web Playback SDK. No pretend audio. */
(async function(){
'use strict';
const sp=window.TransmissionSpotify;
if(!sp){console.error('Spotify authorization module missing');return}
const $=id=>document.getElementById(id);
const list={tracks:[],playlists:[],recent:[],shared:null},owner=sp.CONFIG.ownerId;
let account=null,player=null,device=null,deviceSelected=false,hero=0,featured=null;
let selected=null,lastPlayerState=null,poll=null,sdkPromise=null,lastOnAirId=null;
const safeArt=u=>typeof u==='string'&&/^https:\/\/(i\.scdn\.co|mosaic\.scdn\.co|image-cdn-ak\.spotifycdn\.com|seeded-session-images\.scdn\.co)\//.test(u)?u:'';
const title=t=>t?.name||'';
const artist=t=>(t?.artists||[]).map(x=>x.name).filter(Boolean).join(', ')||'';
const img=t=>safeArt(t?.album?.images?.[0]?.url||t?.images?.[0]?.url);
const first=(sel,root=document)=>root.querySelector(sel);
const create=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el};
function status(message,error=false){
  const el=$('spotify-status');
  if(el){el.textContent=message;el.classList.toggle('is-error',error)}
}
function banner(message){status(message);const toast=$('toast');if(!toast)return;toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3200)}
function applyTrackArt(target,t){
  if(!target)return;
  const u=img(t);
  target.style.backgroundImage=u?'url("'+u+'")':'';
  target.classList.toggle('no-cover',!u);
}
function renderHero(index){
  const arr=list.tracks;
  if(!arr.length)return;
  hero=((index%arr.length)+arr.length)%arr.length;
  featured=arr[hero];
  const t=featured;
  $('hero-kicker').textContent='SPOTIFY / '+String(hero+1).padStart(2,'0');
  $('hero-title').textContent=title(t);
  $('hero-description').textContent=artist(t)+' — '+(t.album?.name||'Álbum');
  applyTrackArt($('hero-image'),t);
  $('slider-count').textContent=String(hero+1).padStart(2,'0')+' / '+String(arr.length).padStart(2,'0');
  $('progress-fill').style.width=((hero+1)/arr.length*100)+'%';
  $('hero-play').disabled=false;
  $('pause-slide').textContent='▶';
  $('pause-slide').title='Reproducir esta canción';
}
function renderCoverArt(node,t){
  if(!node)return;
  node.style.backgroundImage=img(t)?'url("'+img(t)+'")':'';
  node.textContent=img(t)?'':(title(t).slice(0,2).toUpperCase()||'T/M');
}
function updatePlayerSong(t){
  if(!t)return;
  selected=t;
  $('player-track').textContent=title(t);
  $('player-artist').textContent=artist(t);
  $('strip-song').textContent=title(t)||'LISTENING';
  $('strip-artist').textContent=artist(t)||'SPOTIFY';
  renderCoverArt($('player-art'),t);
}
function renderTiles(tracks){
  const grid=$('picks-grid');grid.replaceChildren();
  if(!tracks.length){
    const kinds=[
      ['ROTATION','YOUR TOP','Lo que más escuchas','graphic-one'],
      ['FREQUENCIES','MY RECORDS','Carátulas desde Spotify','graphic-two'],
      ['PERSONAL','MY SOUND','Canciones auténticas','graphic-three'],
      ['SPOTIFY','LISTEN IN','Conecta para escuchar','art-focus']
    ];
    kinds.forEach((item,i)=>{
      const card=create('article','record-card');
      const button=create('button','record-image');button.type='button';
      const art=create('span','record-art tm-placeholder '+item[3]);
      const title=create('span','tm-placeholder-title',item[1]);
      art.append(title);button.append(art,create('span','card-play','↗'),create('span','record-index',String(i+1).padStart(3,'0')+' / TRANSMISSION'));
      button.onclick=()=>account?banner('Spotify todavía no devolvió canciones disponibles.'):void sp.login();
      const info=create('div','record-info');const caption=create('div');
      caption.append(create('span','record-type',item[0]),create('h3','',item[1]),create('p','',item[2]));info.append(caption);
      card.append(button,info);grid.append(card);
    });
    return;
  }
  tracks.slice(0,8).forEach((t,i)=>{
    const card=create('article','record-card');
    const button=create('button','record-image');button.type='button';button.title='Reproducir '+title(t);
    const art=create('span','record-art');applyTrackArt(art,t);
    const play=create('span','card-play','▶');
    const mark=create('span','record-index',String(i+1).padStart(3,'0')+' / SPOTIFY');
    button.append(art,play,mark);button.onclick=()=>void playTrack(t);
    const info=create('div','record-info');
    const text=create('div');
    text.append(create('span','record-type','TRACK / '+(t.album?.release_date?.slice(0,4)||'SPOTIFY')),create('h3','',title(t)),create('p','',artist(t)));
    const add=create('button','save-button','↗');add.type='button';add.title='Compartir canción';
    add.onclick=()=>copyLink(t.external_urls?.spotify||'https://open.spotify.com/track/'+t.id);
    info.append(text,add);card.append(button,info);grid.append(card);
  });
}
function renderRail(items){
  const rail=$('mixtapes'),anchor=$('rail-all');
  rail.querySelectorAll('.rail-item').forEach(x=>x.remove());
  if(!items.length){
    const prompts=[
      ['♫','TUS PLAYLISTS','CONECTA TU CUENTA','art-pool'],
      ['◌','TUS FAVORITAS','TU BIBLIOTECA','art-focus'],
      ['⌁','TU HISTORIAL','RECIENTLY PLAYED','art-low'],
      ['✳','COMPARTIR','CON AMIGOS','art-feel']
    ];
    prompts.forEach((p,i)=>{
      const button=create('button','rail-item');button.type='button';
      const cover=create('span','rail-item-cover '+p[3],p[0]);
      const label=create('span','rail-item-label');label.append(document.createTextNode(p[1]),create('small','',p[2]));
      button.append(cover,label,create('span','rail-item-arrow','↗'));
      button.onclick=()=>i===3?$('support').scrollIntoView({behavior:'smooth'}):account?
        $('latest').scrollIntoView({behavior:'smooth'}):void sp.login();
      rail.insertBefore(button,anchor);
    });return;
  }
  items.slice(0,5).forEach((pl,i)=>{
    const button=create('button','rail-item');button.type='button';
    const cover=create('span','rail-item-cover');cover.classList.add('tm-rail-image');
    const u=safeArt(pl?.images?.[0]?.url);if(u)cover.style.backgroundImage='url("'+u+'")';else cover.textContent='♫';
    const label=create('span','rail-item-label');
    label.append(document.createTextNode(pl.name||'PLAYLIST'),create('small','',(pl.items?.total??pl.tracks?.total??'—')+' CANCIONES'));
    button.append(cover,label,create('span','rail-item-arrow','▶'));
    button.onclick=()=>void playPlaylist(pl);
    rail.insertBefore(button,anchor);
  });
}
function renderRecent(tracks){
  const section=$('recent-items');section.replaceChildren();
  if(!tracks.length){section.append(create('p','tm-empty','No hay reproducciones recientes disponibles.'));return}
  tracks.slice(0,5).forEach((t,i)=>{
    const btn=create('button','tm-recent-item');btn.type='button';btn.title='Escuchar '+title(t);
    const cover=create('span','tm-recent-cover');applyTrackArt(cover,t);
    const meta=create('span','tm-recent-desc');meta.append(create('strong','',title(t)),create('small','',artist(t)));
    btn.append(create('span','tm-recent-index',String(i+1).padStart(2,'0')),cover,meta,create('span','tm-recent-arrow','▶'));
    btn.onclick=()=>void playTrack(t);section.append(btn);
  });
}
function renderOtherDetails(){
  $('pick-period').textContent=account?'TU ROTACIÓN / ÚLTIMAS 4 SEMANAS':'SELECCIÓN PERSONAL / CONECTAR SPOTIFY';
  $('collection-count-1').textContent=account?list.tracks.length+' TRACKS DISPONIBLES ↗':'CONECTAR PARA VER ↗';
  $('collection-count-2').textContent=account?list.playlists.length+' PLAYLISTS ↗':'CONECTAR PARA VER ↗';
  $('collection-count-3').textContent=account?list.recent.length+' ÚLTIMAS ESCUCHAS ↗':'CONECTAR PARA VER ↗';
  const user=account?.display_name||'';
  $('owner-display').textContent=user?user.toUpperCase():'SPOTIFY PREMIUM';
  $('connect-button').textContent=account?'DESCONECTAR':'CONECTAR SPOTIFY';
}
function playFeedback(msg,err=false){status(msg,err)}
async function sdk(){
  if(player)return player;
  if(!sdkPromise){
    sdkPromise=new Promise((resolve,reject)=>{
      if(window.Spotify){resolve();return}
      const end=setTimeout(()=>reject(new Error('No se pudo iniciar el SDK de Spotify.')),15000);
      window.onSpotifyWebPlaybackSDKReady=()=>{clearTimeout(end);resolve()};
      const script=document.createElement('script');script.src='https://sdk.scdn.co/spotify-player.js';
      script.onerror=()=>{clearTimeout(end);reject(new Error('Spotify Web Playback SDK no está disponible.'))};
      document.head.appendChild(script)
    });
  }
  await sdkPromise;
  const p=new Spotify.Player({name:'TRANSMISSION / WEB',getOAuthToken:async fn=>{
    try{fn(await sp.getToken())}catch(e){status(e.message,true)}
  },volume:.7});
  p.addListener('ready',({device_id})=>{device=device_id;status('Reproductor listo. Puedes escuchar dentro de esta página.');$('player-device').textContent='WEB PLAYER / LISTO'});
  p.addListener('not_ready',()=>{device=null;deviceSelected=false;status('El dispositivo web dejó de estar disponible.',true)});
  p.addListener('player_state_changed',state=>{
    if(!state)return;
    lastPlayerState=state;
    const t=state.track_window?.current_track;
    if(t){
      updatePlayerSong({id:t.id,uri:t.uri,name:t.name,artists:t.artists||[],
        album:{name:t.album?.name||'',images:t.album?.images||[]},
        external_urls:{spotify:'https://open.spotify.com/track/'+t.id}});
    }
    $('audio-toggle').textContent=state.paused?'▶':'Ⅱ';
    $('audio-toggle').setAttribute('aria-label',state.paused?'Reproducir':'Pausar');
  });
  p.addListener('autoplay_failed',()=>status('Spotify necesita un clic para iniciar audio. Pulsa ▶ sobre una canción.',true));
  ['authentication_error','account_error','playback_error','initialization_error'].forEach(ev=>p.addListener(ev,({message})=>status('Spotify: '+message,true)));
  const ok=await p.connect();
  if(!ok)throw new Error('Spotify no pudo conectar el reproductor. Comprueba Premium y la autorización.');
  player=p;return p;
}
async function activatePlayer(){
  const p=await sdk();
  if(!device){
    const max=Date.now()+9500;
    while(!device&&Date.now()<max)await new Promise(r=>setTimeout(r,100));
  }
  if(!device)throw new Error('Spotify no proporcionó un dispositivo de reproducción. Comprueba Premium y el permiso streaming.');
  if(!deviceSelected){
    await sp.api('/me/player',{method:'PUT',body:JSON.stringify({device_ids:[device],play:false})});
    deviceSelected=true;
    await new Promise(r=>setTimeout(r,500));
  }
}
async function action(fn){
  if(!account){status('Conecta Spotify Premium antes de escuchar.',true);return}
  try{await fn();status('Orden enviada a Spotify. Comprueba la salida de audio del navegador.');setTimeout(readPlaying,1100)}
  catch(e){if(e.status===404)deviceSelected=false;status(e.message||String(e),true)}
}
async function playTrack(t){
  if(!t?.uri)return;
  updatePlayerSong(t);player?.activateElement?.();
  await action(async()=>{
    await activatePlayer();
    await sp.api('/me/player/play?device_id='+encodeURIComponent(device),{
      method:'PUT',body:JSON.stringify({uris:[t.uri]})
    });
  })
}
async function playPlaylist(p){
  if(!p?.uri)return;
  player?.activateElement?.();
  await action(async()=>{
    await activatePlayer();
    await sp.api('/me/player/play?device_id='+encodeURIComponent(device),{
      method:'PUT',body:JSON.stringify({context_uri:p.uri})
    })
  })
}
async function toggle(){
  player?.activateElement?.();
  await action(async()=>{
    await activatePlayer();
    const state=await player.getCurrentState();
    if(state){await player.togglePlay();return}
    const t=selected||featured||list.tracks[0];
    if(t?.uri){await sp.api('/me/player/play?device_id='+encodeURIComponent(device),{
      method:'PUT',body:JSON.stringify({uris:[t.uri]})
    });return}
    await sp.api('/me/player/play?device_id='+encodeURIComponent(device),{method:'PUT'})
  })
}
async function readPlaying(){
  if(!account||document.hidden)return;
  try{
    const data=await sp.api('/me/player');
    if(data?.item){
      updatePlayerSong(data.item);
      $('audio-toggle').textContent=data.is_playing?'Ⅱ':'▶';
      $('player-device').textContent='DEVICE / '+(data.device?.name||'SPOTIFY');
      $('live-label').textContent=data.is_playing?'NOW PLAYING':'PAUSED';
      if(account.id===owner && data.is_playing){renderHighlighted(data.item)}
    }else $('live-label').textContent='READY';
  }catch(e){if(e.status===403||e.status===401)status(e.message,true)}
}
function renderHighlighted(t){
  if(!t?.id||lastOnAirId===t.id)return;
  lastOnAirId=t.id;
  const incoming={...t,uri:t.uri||'spotify:track:'+t.id};
  const existing=list.tracks.findIndex(item=>item.id===incoming.id);
  if(existing>=0)list.tracks.splice(existing,1);
  list.tracks.unshift(incoming);
  if(list.tracks.length>8)list.tracks.length=8;
  renderHero(0);
  $('hero-kicker').textContent='ESTOY ESCUCHANDO / SPOTIFY';
}
async function loadHome(){
  let current=null;
  if(account)try{current=await sp.api('/me/top/tracks?limit=8&time_range=short_term')}catch(e){status('Spotify Top Tracks: '+e.message,true)}
  list.tracks=(current?.items||[]).filter(t=>t?.uri);
  if(!list.tracks.length){
    try{
      const r=await fetch('./featured.json',{cache:'no-store'});
      const data=await r.json();
      if(data?.status==='ready'&&data.track?.id){
        const t=data.track;
        list.tracks=[{id:t.id,uri:'spotify:track:'+t.id,name:t.name,
          artists:[{name:t.artist}],album:{images:[{url:t.image}],name:'Destacada'},
          external_urls:{spotify:'https://open.spotify.com/track/'+t.id}}];
      }
    }catch{}
  }
  if(list.tracks.length){
    renderHero(0);renderTiles(list.tracks);
    if(account?.id===owner)renderHighlighted(list.tracks[0]);
  }else{
    $('hero-kicker').textContent='TRANSMISSION / SPOTIFY';
    $('hero-title').textContent='YOUR FREQUENCY';
    $('hero-description').textContent='Conecta Spotify para cargar carátulas y canciones reales.';
    $('slider-count').textContent='00 / 00';
    $('hero-play').disabled=true;
    $('pause-slide').disabled=true;
    renderTiles([]);
  }
  renderOtherDetails();
}
async function loadPlaylists(){
  let result=null;
  try{result=await sp.api('/me/playlists?limit=20')}catch(e){status('Playlists: '+e.message,true)}
  list.playlists=(result?.items||[]).filter(Boolean);
  renderRail(list.playlists);
  renderOtherDetails();
}
async function loadRecent(){
  let recent=null;
  try{recent=await sp.api('/me/player/recently-played?limit=8')}catch(e){status('Historial: '+e.message,true)}
  list.recent=(recent?.items||[]).map(x=>x.track).filter(Boolean);
  renderRecent(list.recent);
  renderOtherDetails();
}
async function loadShared(id){
  if(!/^[a-zA-Z0-9]{22}$/.test(id))throw Error('Enlace de playlist no válido.');
  if(!account)throw Error('Conecta Spotify primero para escuchar.');
  const data=await sp.api('/playlists/'+id);
  list.shared=data;
  $('shared-name').textContent=data.name||'Playlist';
  $('shared-button').disabled=false;
  $('shared-info').textContent='PLAYLIST LISTA / '+(data.owner?.display_name||'SPOTIFY');
  const u=new URL(location.href);u.searchParams.set('playlist',id);history.replaceState(null,'',u.pathname+u.search+u.hash);
  status('Playlist cargada: '+data.name);
}
async function searchTracks(value){
  if(!account){banner('Conecta Spotify primero.');return}
  const results=$('search-results');results.replaceChildren(create('p','tm-empty','Buscando canciones reales en Spotify...'));
  try{
    const data=await sp.api('/search?'+new URLSearchParams({q:value,type:'track',limit:'10'}));
    results.replaceChildren();
    for(const t of data.tracks?.items||[]){
      const btn=create('button','search-result');btn.type='button';
      const name=create('span','',title(t));const artistText=create('small','',artist(t));
      btn.append(name,artistText);
      btn.onclick=()=>{closeOverlay();void playTrack(t)};
      results.append(btn);
    }
    if(!results.children.length)results.append(create('p','tm-empty','No se encontraron resultados.'));
  }catch(e){results.replaceChildren(create('p','tm-empty',e.message));status(e.message,true)}
}
function openOverlay(){const v=$('search-overlay');v.classList.add('is-open');v.setAttribute('aria-hidden','false');$('search-input').focus()}
function closeOverlay(){const v=$('search-overlay');v.classList.remove('is-open');v.setAttribute('aria-hidden','true')}
async function copyLink(url){
  try{await navigator.clipboard.writeText(url);banner('Enlace copiado.')}
  catch{banner('Copia el enlace desde Spotify.')}
}
function parsePlaylist(s){
  const v=String(s||'').trim();
  if(/^[a-zA-Z0-9]{22}$/.test(v))return v;
  if(/^spotify:playlist:[a-zA-Z0-9]{22}$/.test(v))return v.split(':')[2];
  try{const url=new URL(v);if(url.hostname!=='open.spotify.com'||url.protocol!=='https:')return null;
    const x=url.pathname.split('/').filter(Boolean);if(x[0]?.startsWith('intl-'))x.shift();
    if(x.length===2&&x[0]==='playlist'&&/^[a-zA-Z0-9]{22}$/.test(x[1]))return x[1];
  }catch{}
  return null;
}
function bind(){
  $('prev-slide').onclick=()=>renderHero(hero-1);
  $('next-slide').onclick=()=>renderHero(hero+1);
  $('pause-slide').onclick=()=>featured?void playTrack(featured):void toggle();
  $('hero-play').onclick=()=>featured?void playTrack(featured):void toggle();
  $('audio-toggle').onclick=()=>void toggle();
  $('audio-next').onclick=()=>void action(()=>sp.api('/me/player/next',{method:'POST'}));
  $('audio-previous').onclick=()=>void action(()=>sp.api('/me/player/previous',{method:'POST'}));
  $('search-trigger').onclick=openOverlay;
  $('search-input').oninput=event=>{
    clearTimeout(window.__tmSearchTimer);
    const v=event.target.value.trim();if(v.length<2){$('search-results').replaceChildren();return}
    window.__tmSearchTimer=setTimeout(()=>void searchTracks(v),350);
  };
  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',closeOverlay));
  $('search-overlay').addEventListener('click',e=>{if(e.target===$('search-overlay'))closeOverlay()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeOverlay()});
  const auth=()=>account?(sp.logout(),location.reload()):void sp.login().catch(e=>status(e.message,true));
  $('connect-button').onclick=auth;
  $('saved-trigger').onclick=auth;
  $('rail-all').onclick=()=>document.getElementById('collections').scrollIntoView({behavior:'smooth'});
  $('collection-top').onclick=()=>document.getElementById('latest').scrollIntoView({behavior:'smooth'});
  $('collection-playlists').onclick=()=>document.getElementById('mixtapes').scrollIntoView({behavior:'smooth'});
  $('collection-recent').onclick=()=>document.getElementById('recent').scrollIntoView({behavior:'smooth'});
  $('random-discovery').onclick=()=>list.tracks.length?renderHero(Math.floor(Math.random()*list.tracks.length)):banner('Conecta Spotify para explorar música.');
  $('shared-form').onsubmit=e=>{e.preventDefault();const id=parsePlaylist($('shared-link').value);if(!id){status('Introduce el enlace real de una playlist de Spotify.',true);return}void loadShared(id).catch(err=>status(err.message,true))}
  $('shared-button').onclick=()=>{if(list.shared)void playPlaylist(list.shared)};
  $('shared-share').onclick=()=>void copyLink(location.href);
  $('reconnect-button').onclick=auth;
  const toggle=$('menu-toggle'),nav=$('main-nav');
  toggle.onclick=()=>{const open=nav.classList.toggle('is-open');toggle.setAttribute('aria-expanded',String(open))};
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('is-open')));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&account)void readPlaying()});
}
try{
  bind();
  await sp.processRedirect();
  if(sp.isLogged()){
    try{
      account=await sp.api('/me');
      status('Conectado como '+(account.display_name||account.id)+'. Cargando canciones y playlists...');
      renderOtherDetails();
      const results=await Promise.allSettled([loadHome(),loadPlaylists(),loadRecent(),sdk()]);
      const playerFailed=results[3].status==='rejected';
      await readPlaying();
      const requested=new URLSearchParams(location.search).get('playlist');
      if(requested&&/^[a-zA-Z0-9]{22}$/.test(requested))await loadShared(requested);
      clearInterval(poll);poll=setInterval(readPlaying,18000);
      if(playerFailed){
        status('Spotify conectó la cuenta, pero falló el reproductor web: '+String(results[3].reason?.message||results[3].reason),true);
      }else{
        status('Spotify conectado. Haz clic en una carátula para reproducir aquí.');
      }
    }catch(e){status(e.message,true)}
  }else{
    renderRail([]);renderTiles([]);renderRecent([]);renderOtherDetails();await loadHome();
    status('Conecta tu cuenta Spotify Premium para cargar música y reproducir en esta página.');
  }
}catch(e){status('Error de conexión: '+e.message,true)}
})();