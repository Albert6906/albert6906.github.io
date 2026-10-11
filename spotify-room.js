/* TRANSMISSION — authenticated Spotify listening room. */
(async function(){
'use strict';
const sp=window.TransmissionSpotify;
const el=id=>document.getElementById(id);
const $=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e};
let sdkPlayer=null,deviceId=null,playing=false,currentTrack=null,profile=null;
let sdkPending=null,lastTrackId=null,activeMode='top',pollHandle=null;
const musicStatus=el('music-status');
const ownerId=sp.CONFIG.ownerId;
function status(text,bad=false){musicStatus.textContent=text;musicStatus.dataset.error=bad?'true':'false'}
function safeImage(u){return typeof u==='string'&&/^https:\/\/(i\.scdn\.co|mosaic\.scdn\.co|image-cdn-ak\.spotifycdn\.com|seeded-session-images\.scdn\.co)\//.test(u)?u:''}
function addImage(container,url,alt,cls='cover'){
  const image=$('img',cls);
  image.alt=alt||'Portada de álbum';
  image.loading='lazy';
  if(safeImage(url))image.src=url; else{image.style.display='none';container.classList.add('no-cover')}
  container.appendChild(image);
  return image;
}
function person(track){return (track?.artists||[]).map(x=>x.name).filter(Boolean).join(', ')||'Artista sin información'}
function cover(track){return track?.album?.images?.[0]?.url||track?.images?.[0]?.url||''}
function fmt(n){return Math.floor((n||0)/60000)+':'+String(Math.floor((n||0)%60000/1000)).padStart(2,'0')}
function displayTrack(track,{playingState=false}={}){
  if(!track?.id&&!track?.uri)return;
  currentTrack=track;lastTrackId=track.id||null;
  el('current-name').textContent=track.name||'Sin título';
  el('current-artist').textContent=person(track);
  el('current-album').textContent=track.album?.name||'';
  const art=el('current-cover');
  art.replaceChildren();
  addImage(art,cover(track),'Carátula de '+(track.name||'la canción'),'cover-big');
  el('current-cover-wrap').classList.remove('is-empty');
  el('current-share').disabled=false;
  el('current-share').dataset.url=track.external_urls?.spotify|| (track.id?'https://open.spotify.com/track/'+track.id:'');
  el('playerbar-track').textContent=track.name||'Canción';
  el('playerbar-artist').textContent=person(track);
  el('playerbar-art').replaceChildren();
  addImage(el('playerbar-art'),cover(track),'Carátula');
  el('playerbar').classList.add('visible');
  if(playingState)el('source-label').textContent='SONANDO EN TU SPOTIFY';
}
function updateState(isPlaying,position=0,duration=0){
  playing=!!isPlaying;
  el('toggle-button').textContent=isPlaying?'PAUSAR':'REPRODUCIR';
  el('bar-play').textContent=isPlaying?'Ⅱ':'▶';
  el('now-indicator').textContent=isPlaying?'EN REPRODUCCIÓN':'PAUSADO / DISPONIBLE';
  el('duration').textContent=fmt(duration);
  el('position').textContent=fmt(position);
  el('track-progress').max=Math.max(1,duration);
  el('track-progress').value=position;
  el('current-cover-wrap').classList.toggle('is-playing',playing);
}
function makeTrackCard(track,i){
  const card=$('article','track-card');
  const area=$('button','track-art');
  area.type='button';area.title='Reproducir '+(track?.name||'canción');
  addImage(area,cover(track),track?.name);
  const floating=$('span','over-play','▶');area.append(floating);
  area.addEventListener('click',()=>playTrack(track));
  const meta=$('div','track-caption');
  meta.append($('span','track-index',String(i+1).padStart(2,'0')), $('span','track-title',track?.name||'Sin título'),$('span','track-by',person(track)));
  card.append(area,meta);
  return card;
}
function showTracks(items,source){
  const grid=el('tracks-grid');grid.replaceChildren();
  const tracks=items.filter(t=>t&&t.type==='track');
  tracks.forEach((t,i)=>grid.append(makeTrackCard(t,i)));
  el('collection-label').textContent=source;
  if(!tracks.length){
    const empty=$('p','muted','Spotify no devolvió canciones para esta sección.');
    grid.append(empty);
  }
}
function makePlaylistCard(pl){
  const card=$('article','list-card');
  const coverBox=$('button','playlist-image');
  coverBox.type='button';
  addImage(coverBox,pl.images?.[0]?.url,pl.name||'Playlist');
  coverBox.addEventListener('click',()=>playContext(pl.uri||('spotify:playlist:'+pl.id)));
  const title=$('h3','list-name',pl.name||'Lista sin título');
  const details=$('p','list-count',String(pl.items?.total ?? pl.tracks?.total ?? 0)+' CANCIONES');
  const tools=$('div','list-actions');
  const play=$('button','text-link','▶ ESCUCHAR');play.type='button';play.onclick=()=>playContext(pl.uri||('spotify:playlist:'+pl.id));
  const open=$('a','text-link','VER ↗');open.href=pl.external_urls?.spotify||'https://open.spotify.com/playlist/'+pl.id;open.rel='noopener noreferrer';open.target='_blank';
  tools.append(play,open);card.append(coverBox,title,details,tools);
  return card;
}
async function loadTop(range='short_term'){
  activeMode=range;
  el('top-short').classList.toggle('selected',range==='short_term');
  el('top-medium').classList.toggle('selected',range==='medium_term');
  el('top-long').classList.toggle('selected',range==='long_term');
  el('tracks-grid').replaceChildren($('p','muted','Consultando tus canciones...'));
  try{
    const data=await sp.api('/me/top/tracks?limit=12&time_range='+range);
    showTracks(data.items||[],range==='short_term'?'MÁS ESCUCHADAS / ÚLTIMAS 4 SEMANAS':
      range==='medium_term'?'MÁS ESCUCHADAS / ÚLTIMOS 6 MESES':'MÁS ESCUCHADAS / ÚLTIMO AÑO');
    if(profile?.id===ownerId && (data.items||[])[0]) {
      const first=data.items[0];
      el('editorial-note').textContent='Tu canción destacada del período: '+first.name+' — '+person(first)+'. Se actualiza al consultar Spotify mientras estás conectado.';
      // The public home page is not automatically updated for other users: that needs a backend.
      sessionStorage.setItem('tm_owner_feature',JSON.stringify({
        name:first.name,artist:person(first),image:safeImage(cover(first)),track:first.id,
        timestamp:Date.now(),source:'top',owner:ownerId
      }));
    }
  }catch(e){el('tracks-grid').replaceChildren($('p','muted',e.message));status(e.message,true)}
}
async function loadLists(){
  el('playlists-grid').replaceChildren($('p','muted','Cargando tus playlists...'));
  try{
    const data=await sp.api('/me/playlists?limit=12');
    const grid=el('playlists-grid');grid.replaceChildren();
    const items=(data.items||[]).filter(Boolean);
    for(const item of items)grid.append(makePlaylistCard(item));
    if(!items.length)grid.append($('p','muted','No hay listas disponibles.'));
  }catch(e){el('playlists-grid').replaceChildren($('p','muted',e.message));status(e.message,true)}
}
async function loadRecent(){
  el('recent-grid').replaceChildren($('p','muted','Recuperando las últimas escuchas...'));
  try{
    const data=await sp.api('/me/player/recently-played?limit=8');
    const items=(data.items||[]).map(x=>x.track).filter(Boolean);
    const grid=el('recent-grid');grid.replaceChildren();
    for(let i=0;i<items.length;i++)grid.append(makeTrackCard(items[i],i));
    if(!items.length)grid.append($('p','muted','Todavía no hay escuchas recientes disponibles.'));
  }catch(e){el('recent-grid').replaceChildren($('p','muted',e.message))}
}
async function updatePlayback(){
  if(!sp.isLogged()||document.hidden)return;
  try {
    const data=await sp.api('/me/player');
    if(data?.item){
      displayTrack(data.item,{playingState:true});
      updateState(data.is_playing,data.progress_ms||0,data.item.duration_ms||0);
      el('current-device').textContent=data.device?.name?('DISPOSITIVO / '+data.device.name.toUpperCase()):'SPOTIFY CONNECT';
      if(profile?.id===ownerId){
        sessionStorage.setItem('tm_owner_now',JSON.stringify({
          name:data.item.name,artist:person(data.item),image:safeImage(cover(data.item)),track:data.item.id,
          playing:data.is_playing,timestamp:Date.now(),owner:ownerId
        }));
      }
    }else{
      el('now-indicator').textContent='SIN REPRODUCCIÓN ACTIVA';
      if(!currentTrack)el('source-label').textContent='CONECTADO A TU SPOTIFY';
    }
  }catch(e){
    if(e.status===429){status('Spotify ha limitado temporalmente las consultas. Vuelve a intentarlo más tarde.',true);clearInterval(pollHandle)}
  }
}
function sdkReady(){
  if(window.Spotify)return Promise.resolve();
  if(sdkPending)return sdkPending;
  sdkPending=new Promise((resolve,reject)=>{
    const limit=setTimeout(()=>reject(new Error('Spotify Web Playback SDK no respondió. Comprueba bloqueadores de contenido.')),15000);
    window.onSpotifyWebPlaybackSDKReady=()=>{clearTimeout(limit);resolve()};
    const script=document.createElement('script');script.src='https://sdk.scdn.co/spotify-player.js';
    script.async=true;script.onerror=()=>{clearTimeout(limit);reject(new Error('No se pudo cargar el reproductor de Spotify.'))};
    document.head.appendChild(script);
  });
  return sdkPending;
}
async function initializePlayer(){
  if(sdkPlayer)return sdkPlayer;
  await sdkReady();
  const player=new Spotify.Player({
    name:'TRANSMISSION / WEB PLAYER',
    getOAuthToken: async cb=>{try{cb(await sp.getToken())}catch(e){status(e.message,true)}},
    volume:0.65
  });
  player.addListener('ready',({device_id})=>{
    deviceId=device_id;
    el('device-label').textContent='WEB PLAYER / LISTO';
    el('listen-here').disabled=false;
    status('Reproductor conectado. Pulsa «Escuchar aquí» para enviar el audio a esta página.');
  });
  player.addListener('not_ready',()=>{deviceId=null;el('device-label').textContent='WEB PLAYER / SIN CONEXIÓN';el('listen-here').disabled=true});
  player.addListener('player_state_changed',state=>{
    if(!state)return;
    const t=state.track_window?.current_track;
    if(t){
      const track={
        id:t.id,uri:t.uri,name:t.name,artists:t.artists||[],
        album:{name:t.album?.name||'',images:t.album?.images||[]},
        duration_ms:t.duration_ms,
        external_urls:{spotify:t.id?'https://open.spotify.com/track/'+t.id:''}
      };
      displayTrack(track,{playingState:true});
      updateState(!state.paused,state.position,t.duration_ms);
    }
  });
  ['initialization_error','authentication_error','account_error','playback_error'].forEach(evt=>{
    player.addListener(evt,({message})=>status('Reproductor Spotify: '+message,true));
  });
  const connected=await player.connect();
  if(!connected){player.disconnect();throw new Error('No se pudo abrir el reproductor de Spotify en este navegador.')}
  sdkPlayer=player;return player;
}
async function useBrowserDevice(){
  if(!sdkPlayer)await initializePlayer();
  if(!deviceId) {
    const deadline=Date.now()+9000;
    while(!deviceId&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,120));
  }
  if(!deviceId)throw new Error('Spotify todavía no reconoce este navegador como dispositivo. Inténtalo nuevamente.');
  await sp.api('/me/player',{method:'PUT',body:JSON.stringify({device_ids:[deviceId],play:false})});
  el('current-device').textContent='DISPOSITIVO / TRANSMISSION WEB';
}
async function runAction(label,fn){
  status(label);
  try{await fn();status('Listo. El audio se reproduce mediante Spotify Premium dentro de esta página.');setTimeout(updatePlayback,1300)}
  catch(e){status(e.message,true)}
}
async function playTrack(track){
  if(!track?.uri)return;
  displayTrack(track);
  if(!sp.isLogged()){status('Conecta tu cuenta Premium antes de reproducir.',true);return}
  // Browser audio activation may require a direct user click on iOS/Safari.
  const activation=sdkPlayer?.activateElement?.();void activation;
  await runAction('Preparando canción...',async()=>{
    await useBrowserDevice();
    await sp.api('/me/player/play?device_id='+encodeURIComponent(deviceId),{
      method:'PUT',body:JSON.stringify({uris:[track.uri]})
    });
  });
}
async function playContext(uri){
  if(!uri)return;
  const activation=sdkPlayer?.activateElement?.();void activation;
  await runAction('Preparando playlist...',async()=>{
    await useBrowserDevice();
    await sp.api('/me/player/play?device_id='+encodeURIComponent(deviceId),{
      method:'PUT',body:JSON.stringify({context_uri:uri})
    });
  });
}
async function search(){
  const query=el('search-query').value.trim();
  if(!query)return;
  const results=el('search-results');
  results.replaceChildren($('p','muted','Buscando en Spotify...'));
  try{
    const data=await sp.api('/search?'+new URLSearchParams({q:query,type:'track',limit:'10'}));
    showSearch(data.tracks?.items||[]);
  }catch(e){results.replaceChildren($('p','muted',e.message));status(e.message,true)}
}
function showSearch(items){
  const results=el('search-results');results.replaceChildren();
  items.filter(x=>x?.type==='track').forEach((track,i)=>{
    const card=$('button','result-row');card.type='button';
    const img=$('span','result-art');addImage(img,cover(track),track.name);
    const info=$('span','result-info');info.append($('b','',track.name),$('small','',person(track)));
    const play=$('span','result-play','▶');
    card.append(img,info,play);card.onclick=()=>playTrack(track);results.append(card);
  });
  if(!results.children.length)results.append($('p','muted','Sin resultados para esta búsqueda.'));
}
async function afterLogin(){
  el('connect-view').hidden=true;
  el('connected-view').hidden=false;
  status('Autorización recibida. Cargando biblioteca musical...');
  try{
    profile=await sp.api('/me');
    el('account-name').textContent=profile.display_name||profile.id||'Cuenta Spotify';
    el('owner-tag').textContent=profile.id===ownerId?'CUENTA PRINCIPAL':'INVITADO/A PREMIUM';
    el('owner-tag').dataset.owner=profile.id===ownerId?'true':'false';
  }catch(e){status(e.message,true)}
  await Promise.allSettled([loadTop(),loadLists(),loadRecent(),initializePlayer()]);
  await updatePlayback();
  clearInterval(pollHandle);
  pollHandle=setInterval(updatePlayback,18000);
  if(!musicStatus.dataset.error)status('Conectado. Selecciona una canción o escucha tu Spotify actual dentro de esta página.');
}
el('connect-button').onclick=()=>sp.login().catch(e=>status(e.message,true));
el('disconnect-button').onclick=()=>{
  clearInterval(pollHandle);sdkPlayer?.disconnect();sp.logout();location.replace(sp.CONFIG.redirectUri);
};
el('listen-here').onclick=()=>{
  const activation=sdkPlayer?.activateElement?.();void activation;
  runAction('Trasladando audio a este navegador...',async()=>{await useBrowserDevice();});
};
el('toggle-button').onclick=()=>{
  const activation=sdkPlayer?.activateElement?.();void activation;
  runAction('Actualizando reproducción...',async()=>{
    if(!sdkPlayer)await initializePlayer();
    const state=await sdkPlayer.getCurrentState();
    if(!state&&!deviceId)throw new Error('Todavía no hay un dispositivo activo.');
    if(!state)await useBrowserDevice();
    await sdkPlayer.togglePlay();
  });
};
el('bar-play').onclick=()=>el('toggle-button').click();
el('previous').onclick=()=>runAction('Canción anterior...',async()=>{await sp.api('/me/player/previous',{method:'POST'})});
el('next').onclick=()=>runAction('Siguiente canción...',async()=>{await sp.api('/me/player/next',{method:'POST'})});
el('current-share').onclick=async()=>{
  const url=el('current-share').dataset.url;
  if(!url)return;
  try{await navigator.clipboard.writeText(url);status('Enlace de canción copiado.')}
  catch{status('Abre la canción en Spotify y copia su enlace.')}
};
el('top-short').onclick=()=>loadTop('short_term');
el('top-medium').onclick=()=>loadTop('medium_term');
el('top-long').onclick=()=>loadTop('long_term');
el('search-form').onsubmit=e=>{e.preventDefault();search()};
el('track-progress').onchange=e=>runAction('Cambiando posición...',async()=>{
  await sp.api('/me/player/seek?position_ms='+Math.max(0,Number(e.target.value)||0),{method:'PUT'});
});
el('refresh-data').onclick=async()=>{await Promise.allSettled([loadTop(activeMode),loadLists(),loadRecent(),updatePlayback()]);status('Biblioteca actualizada.')};
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&sp.isLogged())updatePlayback()});
try {
  await sp.processRedirect();
  if(sp.isLogged())await afterLogin();
  else status('Conecta tu Spotify Premium. No guardamos contraseñas ni alojamos tu música.');
}catch(e){
  status(e.message,true);
  el('connect-view').hidden=false;
  el('connected-view').hidden=true;
}
})();