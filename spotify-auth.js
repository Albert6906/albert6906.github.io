/* TRANSMISSION — Spotify auth, Authorization Code + PKCE.
   Tokens are stored in this browser tab's session only. Never place a client secret here. */
(function () {
  'use strict';
  const CONFIG = Object.freeze({
    clientId: '9dca144b3c2c42889f8d3f58705a85d0',
    redirectUri: 'https://salempro123a-sudo.github.io/musica.html',
    ownerId: '31irk65dnljb6i3jfg57lkixtgqu',
    scopes: ['user-read-private','user-read-playback-state','user-modify-playback-state','user-read-currently-playing','user-top-read','playlist-read-private','user-read-recently-played']
  });
  const KEY='transmission_spotify_v1';
  const PKCE='transmission_spotify_pkce_v1';
  let refreshing=null;
  const tokenStore={
    read(){ try {return JSON.parse(sessionStorage.getItem(KEY)||'null')}catch{return null} },
    write(x){sessionStorage.setItem(KEY,JSON.stringify(x))},
    clear(){sessionStorage.removeItem(KEY)}
  };
  function base64url(bytes){
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function randomToken(n=32) {
    const array = new Uint8Array(n);
    crypto.getRandomValues(array);
    return base64url(array);
  }
  async function challengeFrom(verifier) {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256',data);
    return base64url(new Uint8Array(digest));
  }
  function saveToken(result, oldRefresh) {
    if (!result.access_token) throw new Error('Spotify no devolvió un access token.');
    const token={
      access: result.access_token,
      refresh: result.refresh_token||oldRefresh||'',
      expiresAt:Date.now()+Math.max(60,Number(result.expires_in||3600)-60)*1000
    };
    tokenStore.write(token);
    return token;
  }
  async function login() {
    const verifier=randomToken(64),state=randomToken(20);
    sessionStorage.setItem(PKCE,JSON.stringify({verifier,state,at:Date.now()}));
    const url=new URL('https://accounts.spotify.com/authorize');
    url.search=new URLSearchParams({
      client_id:CONFIG.clientId,response_type:'code',redirect_uri:CONFIG.redirectUri,
      code_challenge_method:'S256',code_challenge:await challengeFrom(verifier),
      state,scope:CONFIG.scopes.join(' '),show_dialog:'false'
    });
    location.assign(url.href);
  }
  async function processRedirect(){
    const params=new URLSearchParams(location.search);
    const code=params.get('code'),err=params.get('error');
    if(!code&&!err)return false;
    history.replaceState(null,'',location.pathname+location.hash);
    if(err)throw new Error('Spotify canceló la autorización: '+err);
    const str=sessionStorage.getItem(PKCE);
    sessionStorage.removeItem(PKCE);
    if(!str)throw new Error('La verificación caducó. Vuelve a conectar tu cuenta.');
    let saved;try{saved=JSON.parse(str)}catch{}
    if(!saved||saved.state!==params.get('state')||Date.now()-saved.at>600000)
      throw new Error('No se pudo validar la sesión de Spotify. Inténtalo de nuevo.');
    const response=await fetch('https://accounts.spotify.com/api/token',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({client_id:CONFIG.clientId,grant_type:'authorization_code',
        code,redirect_uri:CONFIG.redirectUri,code_verifier:saved.verifier})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error('Spotify no autorizó la conexión ('+response.status+'). Revisa la Redirect URI registrada.');
    saveToken(result);
    return true;
  }
  async function refresh(){
    if(refreshing)return refreshing;
    const saved=tokenStore.read();
    if(!saved?.refresh){tokenStore.clear();throw new Error('La sesión caducó. Conéctate de nuevo.')}
    refreshing=(async()=>{
      const res=await fetch('https://accounts.spotify.com/api/token',{
        method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({client_id:CONFIG.clientId,grant_type:'refresh_token',refresh_token:saved.refresh})
      });
      const result=await res.json().catch(()=>({}));
      if(!res.ok){tokenStore.clear();throw new Error('Spotify cerró la autorización. Vuelve a conectar tu cuenta.')}
      return saveToken(result,saved.refresh).access;
    })();
    try{return await refreshing}finally{refreshing=null}
  }
  async function getToken(force=false){
    const saved=tokenStore.read();
    if(!saved?.access)throw new Error('Conecta tu cuenta Spotify para continuar.');
    return force || Date.now()>=saved.expiresAt ? refresh() : saved.access;
  }
  class SpotifyError extends Error {
    constructor(code,message){super(message);this.status=code;this.name='SpotifyError'}
  }
  async function api(path,options={},retry=true){
    const access=await getToken();
    const target='https://api.spotify.com/v1'+path;
    const headers={'Authorization':'Bearer '+access,...options.headers};
    if(options.body && !headers['Content-Type'])headers['Content-Type']='application/json';
    const res=await fetch(target,{...options,headers});
    if(res.status===401&&retry){
      await getToken(true);
      return api(path,options,false);
    }
    if(!res.ok){
      const detail=await res.json().catch(()=>({}));
      const reason=detail?.error?.reason||detail?.error?.message||'';
      const message=res.status===403?'Spotify no permitió esta función. Comprueba Premium, permisos y usuarios autorizados en Developer Dashboard.':
        res.status===429?'Demasiadas solicitudes a Spotify. Espera unos segundos.':
        'Spotify respondió '+res.status+(reason?': '+String(reason):'');
      throw new SpotifyError(res.status,message);
    }
    return res.status===204?null:res.json();
  }
  function logout(){tokenStore.clear();sessionStorage.removeItem(PKCE)}
  window.TransmissionSpotify={CONFIG,login,processRedirect,getToken,api,logout,isLogged:()=>!!tokenStore.read()?.access};
})();