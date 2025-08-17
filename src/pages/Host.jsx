import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { createClient } from '@supabase/supabase-js'

// ---- Supabase (for roster) ----
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ---- PKCE helpers ----
async function sha256(str) {
  const data = new TextEncoder().encode(str)
  return crypto.subtle.digest('SHA-256', data)
}
function base64url(arrBuf) {
  return btoa(String.fromCharCode(...new Uint8Array(arrBuf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'')
}
async function makePkce() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
  const challenge = base64url(await sha256(verifier))
  return { verifier, challenge }
}

export default function Host() {
  const canvasRef = useRef(null)
  const [sid] = useState(() => crypto.randomUUID())
  const [members, setMembers] = useState([])
  const [err, setErr] = useState('')

  // your live domain; QR uses hash route
  const base = "https://scrapbook-ggi2.vercel.app"
  const joinUrl = `${base}/#/join?sid=${sid}`

  // Spotify state
  const [spotifyTokens, setSpotifyTokens] = useState(() =>
    JSON.parse(localStorage.getItem('spotify_tokens') || 'null')
  )
  const [nowPlaying, setNowPlaying] = useState(null)

  // Draw QR
  useEffect(() => {
    QRCode.toCanvas(canvasRef.current, joinUrl, { errorCorrectionLevel: 'M' })
  }, [joinUrl])

  // Roster polling
  async function fetchMembers() {
    const { data, error } = await supabase
      .from('members')
      .select('username')
      .eq('sid', sid)
      .order('joined_at', { ascending: true })
    if (error) setErr(error.message)
    setMembers(data || [])
  }
  useEffect(() => {
    fetchMembers()
    const id = setInterval(fetchMembers, 2000)
    return () => clearInterval(id)
  }, [sid])

  // Connect to Spotify (PKCE) — send verifier in `state`
  async function connectSpotify() {
    const { verifier, challenge } = await makePkce()

    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: import.meta.env.VITE_SPOTIFY_REDIRECT_URI,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      // carry the verifier back via state
      state: verifier,
      scope: 'user-read-currently-playing user-read-playback-state'
    })

    const popup = window.open(
      `https://accounts.spotify.com/authorize?${params.toString()}`,
      'spotifyAuth',
      'width=520,height=720'
    )

    // tokens posted back by /api/spotify/callback
    const onMsg = (ev) => {
      if (!ev.data || !ev.data.access_token) return
      localStorage.setItem('spotify_tokens', JSON.stringify(ev.data))
      setSpotifyTokens(ev.data)
      popup && popup.close()
      window.removeEventListener('message', onMsg)
    }
    window.addEventListener('message', onMsg)
  }

  // Poll Now Playing
  useEffect(() => {
    if (!spotifyTokens?.access_token) return
    let stop = false
    const tick = async () => {
      try {
        const res = await fetch(
          'https://api.spotify.com/v1/me/player/currently-playing',
          { headers: { Authorization: `Bearer ${spotifyTokens.access_token}` } }
        )
        if (res.status === 204) { setNowPlaying(null); return }
        const json = await res.json()
        if (!stop) setNowPlaying(json)
      } catch (e) { console.error(e) }
    }
    tick()
    const id = setInterval(tick, 4000)
    return () => { stop = true; clearInterval(id) }
  }, [spotifyTokens])

  return (
    <main style={{display:'grid',placeItems:'center',height:'100vh',background:'#000',color:'#fff',fontFamily:'system-ui'}}>
      <div style={{ textAlign:'center', maxWidth:1000 }}>
        {/* Now Playing / Connect */}
        <div style={{ marginBottom:24 }}>
          {spotifyTokens?.access_token ? (
            nowPlaying ? (
              <div style={{display:'inline-flex',alignItems:'center',gap:16,padding:12,background:'#111',borderRadius:12}}>
                <img
                  src={nowPlaying?.item?.album?.images?.[0]?.url}
                  alt="" width="80" height="80" style={{borderRadius:8,objectFit:'cover'}}
                />
                <div style={{textAlign:'left'}}>
                  <div style={{fontSize:20,fontWeight:700}}>{nowPlaying?.item?.name || '—'}</div>
                  <div style={{opacity:.8}}>
                    {nowPlaying?.item?.artists?.map(a => a.name).join(', ')}
                  </div>
                </div>
              </div>
            ) : <div style={{opacity:.8}}>Nothing playing</div>
          ) : (
            <button onClick={connectSpotify}>Connect Spotify</button>
          )}
        </div>

        {/* QR + roster */}
        <canvas ref={canvasRef} style={{width:'60vmin',height:'60vmin',background:'#fff',padding:'2vmin',borderRadius:'2vmin'}} />
        <div style={{ marginTop:12, opacity:.85 }}>Scan to join</div>
        <div style={{ marginTop:8, fontSize:'1.8vmin', opacity:.6 }}>SID: {sid}</div>

        <h2 style={{ marginTop:24, fontSize:'2.4vmin' }}>Currently logged in users:</h2>
        {err && <div style={{color:'#ff6b6b', fontSize:'2vmin'}}>Error: {err}</div>}
        <ul style={{ listStyle:'none', padding:0, margin:0, fontSize:'2.2vmin' }}>
          {members.length ? members.map(m => <li key={m.username}>{m.username}</li>) : <li>None yet</li>}
        </ul>
      </div>
    </main>
  )
}

