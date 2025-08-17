import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

// ----- PKCE helpers -----
async function sha256(buf){ return crypto.subtle.digest('SHA-256', new TextEncoder().encode(buf)) }
function base64url(arr){
  return btoa(String.fromCharCode(...new Uint8Array(arr))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
}
async function makePkce(){
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
  const challenge = base64url(await sha256(verifier))
  return { verifier, challenge }
}

export default function Host() {
  const canvasRef = useRef(null)
  const [sid] = useState(() => crypto.randomUUID())
  const [members, setMembers] = useState([])
  const [err, setErr] = useState('')
  const base = "https://scrapbook-ggi2.vercel.app"
  const joinUrl = `${base}/#/join?sid=${sid}`

  // Spotify
  const [spotifyToken, setSpotifyToken] = useState(() => JSON.parse(localStorage.getItem('spotify_tokens') || 'null'))
  const [nowPlaying, setNowPlaying] = useState(null)

  // draw QR
  useEffect(() => { QRCode.toCanvas(canvasRef.current, joinUrl, { errorCorrectionLevel: 'M' }) }, [joinUrl])

  // roster (polling)
  async function fetchMembers() {
    const { data, error } = await supabase.from('members').select('username').eq('sid', sid).order('joined_at', { ascending: true })
    if (error) setErr(error.message)
    setMembers(data || [])
  }
  useEffect(() => { fetchMembers(); const id=setInterval(fetchMembers,2000); return ()=>clearInterval(id) }, [sid])

  // connect to Spotify via PKCE
  async function connectSpotify(){
    const { verifier, challenge } = await makePkce()
    sessionStorage.setItem('pkce_verifier', verifier)

    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_SPOTIFY_CLIENT_ID, // optional if you want to expose; else hardcode below
      response_type: 'code',
      redirect_uri: import.meta.env.VITE_SPOTIFY_REDIRECT_URI,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      scope: 'user-read-currently-playing user-read-playback-state',
    })

    // open popup to Spotify, then our /api/spotify/callback posts tokens back
    const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`
    const popup = window.open(authUrl, 'spotifyAuth', 'width=500,height=700')

    window.addEventListener('message', (ev) => {
      if (!ev.data || !ev.data.access_token) return
      const tokens = ev.data
      localStorage.setItem('spotify_tokens', JSON.stringify(tokens))
      setSpotifyToken(tokens)
      popup && popup.close()
    }, { once: true })
  }

  // poll Now Playing if we have a token
  useEffect(() => {
    if (!spotifyToken?.access_token) return
    let stopped = false
    const tick = async () => {
      try {
        const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
          headers: { Authorization: `Bearer ${spotifyToken.access_token}` }
        })
        if (res.status === 204) { setNowPlaying(null); return } // nothing playing
        const json = await res.json()
        if (!stopped) setNowPlaying(json)
      } catch (e) { console.error(e) }
    }
    tick()
    const id = setInterval(tick, 4000)
    return () => { stopped = true; clearInterval(id) }
  }, [spotifyToken])

  return (
    <main style={{display:'grid',placeItems:'center',height:'100vh',background:'#000',color:'#fff',fontFamily:'system-ui'}}>
      <div style={{ textAlign:'center', maxWidth:1000 }}>
        {/* Top row: Now Playing + Connect */}
        <div style={{marginBottom:24}}>
          {spotifyToken?.access_token ? (
            nowPlaying ? (
              <div style={{display:'inline-flex',alignItems:'center',gap:16, padding:12, background:'#111', borderRadius:12}}>
                <img
                  src={nowPlaying?.item?.album?.images?.[0]?.url}
                  alt="" width="80" height="80" style={{borderRadius:8, objectFit:'cover'}}
                />
                <div style={{textAlign:'left'}}>
                  <div style={{fontSize:20, fontWeight:700}}>{nowPlaying?.item?.name || '—'}</div>
                  <div style={{opacity:.8}}>{nowPlaying?.item?.artists?.map(a=>a.name).join(', ')}</div>
                </div>
              </div>
            ) : (
              <div style={{opacity:.8}}>Nothing playing</div>
            )
          ) : (
            <button onClick={connectSpotify}>Connect Spotify</button>
          )}
        </div>

        {/* QR + roster */}
        <canvas ref={canvasRef} style={{width:'60vmin',height:'60vmin',background:'#fff',padding:'2vmin',borderRadius:'2vmin'}} />
        <div style={{ marginTop:12, opacity:.85 }}>Scan to join</div>
        <div style={{marginTop:8, fontSize:'1.8vmin', opacity:.6}}>SID: {sid}</div>

        <h2 style={{ marginTop:24, fontSize:'2.4vmin' }}>Currently logged in users:</h2>
        {err && <div style={{color:'#ff6b6b', fontSize:'2vmin'}}>Error: {err}</div>}
        <ul style={{ listStyle:'none', padding:0, margin:0, fontSize:'2.2vmin' }}>
          {members.length === 0 ? <li>None yet</li> :
            members.map(m => <li key={m.username}>{m.username}</li>)
          }
        </ul>
      </div>
    </main>
  )
}

