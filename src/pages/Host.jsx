import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { createClient } from '@supabase/supabase-js'

// ---- Supabase ----
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ---- PKCE helpers (Spotify) ----
async function sha256(s) { const d=new TextEncoder().encode(s); return crypto.subtle.digest('SHA-256', d) }
function b64url(buf){ return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'') }
async function makePkce(){ const v=b64url(crypto.getRandomValues(new Uint8Array(32))); const c=b64url(await sha256(v)); return { verifier:v, challenge:c } }

// ---- avatar util (stable color) ----
function avatarFor(name='?'){
  let h=0; for(let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))|0
  const hue=Math.abs(h)%360
  return { bg:`hsl(${hue} 70% 45%)`, initial:(name[0]||'?').toUpperCase() }
}

export default function Host(){
  // ---------- Sticky session id ----------
  const initialSid = (() => {
    const saved = localStorage.getItem('host_sid')
    const s = saved || crypto.randomUUID()
    if (!saved) localStorage.setItem('host_sid', s)
    return s
  })()
  const [sid, setSid] = useState(initialSid)
  useEffect(() => { localStorage.setItem('host_sid', sid) }, [sid])

  const base = "https://scrapbook-ggi2.vercel.app"
  const joinUrl = `${base}/#/join?sid=${sid}`

  // ---------- QR always visible ----------
  const canvasRef = useRef(null)
  useEffect(() => { QRCode.toCanvas(canvasRef.current, joinUrl, { errorCorrectionLevel:'M' }) }, [joinUrl])

  // ---------- Roster (members) + Presence (active within 30s) ----------
  const [members, setMembers] = useState([])     // all who joined
  const [activeSet, setActiveSet] = useState(new Set()) // who is online now
  const [err, setErr] = useState('')

  async function fetchMembers(){
    const { data, error } = await supabase
      .from('members')
      .select('username')
      .eq('sid', sid)
      .order('joined_at', { ascending:true })
    if (error) setErr(error.message)
    setMembers(data || [])
  }

  async function fetchPresence(){
    const cutoff = new Date(Date.now() - 30_000).toISOString()
    const { data } = await supabase
      .from('presence')
      .select('username,last_seen')
      .eq('sid', sid)
      .gte('last_seen', cutoff)
    setActiveSet(new Set((data||[]).map(r=>r.username)))
  }

  useEffect(() => {
    fetchMembers(); fetchPresence()
    const id1 = setInterval(fetchMembers, 4000)
    const id2 = setInterval(fetchPresence, 4000)
    return () => { clearInterval(id1); clearInterval(id2) }
  }, [sid])

  async function removeMember(name){
    const ok = confirm(`Remove ${name} from this session?`)
    if (!ok) return
    const { error } = await supabase.from('members').delete().eq('sid', sid).eq('username', name)
    if (error) setErr(error.message)
    await fetchMembers()
    await supabase.from('presence').delete().eq('sid', sid).eq('username', name)
    await fetchPresence()
  }

  function activeOnly(list){ return list.filter(m => activeSet.has(m.username)) }

  // ---------- Spotify Now Playing + likes ----------
  const [spotifyTokens, setSpotifyTokens] = useState(() =>
    JSON.parse(localStorage.getItem('spotify_tokens') || 'null')
  )
  const [nowPlaying, setNowPlaying] = useState(null)
  const current = useMemo(() => {
    const it = nowPlaying?.item
    if (!it) return null
    return {
      uri: it.uri,
      title: it.name,
      artist: (it.artists||[]).map(a=>a.name).join(', '),
      artwork: it.album?.images?.[0]?.url || ''
    }
  }, [nowPlaying])

  const [likedUsers, setLikedUsers] = useState([])

  async function refreshLikes(uri){
    if (!uri) return setLikedUsers([])
    const { data } = await supabase
      .from('liked_songs')
      .select('username')
      .eq('sid', sid)
      .eq('uri', uri)
    setLikedUsers((data||[]).map(r=>r.username))
  }

  useEffect(() => { refreshLikes(current?.uri) }, [current?.uri, sid])

  useEffect(() => {
    const ch = supabase.channel('likes-live')
      .on('postgres_changes',
        { event:'*', schema:'public', table:'liked_songs', filter:`sid=eq.${sid}` },
        () => refreshLikes(current?.uri)
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [sid, current?.uri])

  // Poll Spotify; also upsert to now_playing so phones can read a stable record
  useEffect(() => {
    if (!spotifyTokens?.access_token) return
    let stop = false
    const tick = async () => {
      try {
        const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
          headers: { Authorization: `Bearer ${spotifyTokens.access_token}` }
        })
        if (res.status === 204) { setNowPlaying(null); return }
        const json = await res.json()
        if (!stop) setNowPlaying(json)

        const it = json?.item
        if (it) {
          await supabase.from('now_playing').upsert({
            sid,
            uri: it.uri,
            title: it.name,
            artist: (it.artists||[]).map(a=>a.name).join(', '),
            artwork: it.album?.images?.[0]?.url || '',
            updated_at: new Date().toISOString()
          })
        }
      } catch(e){ console.error(e) }
    }
    tick()
    const id = setInterval(tick, 4000)
    return () => { stop=true; clearInterval(id) }
  }, [spotifyTokens, sid])

  async function connectSpotify(){
    const { verifier, challenge } = await makePkce()
    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: import.meta.env.VITE_SPOTIFY_REDIRECT_URI,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state: verifier,
      scope: 'user-read-currently-playing user-read-playback-state'
    })
    const popup = window.open(
      `https://accounts.spotify.com/authorize?${params.toString()}`,
      'spotifyAuth','width=520,height=720'
    )
    const onMsg = (ev) => {
      if (!ev.data || !ev.data.access_token) return
      localStorage.setItem('spotify_tokens', JSON.stringify(ev.data))
      setSpotifyTokens(ev.data)
      popup && popup.close()
      window.removeEventListener('message', onMsg)
    }
    window.addEventListener('message', onMsg)
  }

  // New session button if you want to rotate
  async function newSession(){
    if (!confirm('Start a new session? Current roster/likes view will reset.')) return
    const s = crypto.randomUUID()
    localStorage.setItem('host_sid', s)
    setSid(s)
  }

  return (
    <main style={{display:'grid',placeItems:'center',height:'100vh',background:'#000',color:'#fff',fontFamily:'system-ui'}}>
      <div style={{ textAlign:'center', maxWidth:1050 }}>
        {/* Top row: Now Playing + Connect + New Session */}
        <div style={{ display:'flex', gap:12, justifyContent:'center', alignItems:'center', marginBottom:16 }}>
          {spotifyTokens?.access_token ? (
            current ? (
              <div style={{display:'inline-flex',alignItems:'center',gap:16,padding:12,background:'#111',borderRadius:12}}>
                {current.artwork && <img src={current.artwork} alt="" width="90" height="90" style={{borderRadius:10,objectFit:'cover'}} />}
                <div style={{textAlign:'left'}}>
                  <div style={{fontSize:22,fontWeight:700}}>{current.title}</div>
                  <div style={{opacity:.8}}>{current.artist}</div>
                  <div style={{opacity:.7,fontSize:14,marginTop:6}}>
                    {likedUsers.length ? `${likedUsers.length} like${likedUsers.length>1?'s':''}` : 'No likes yet'}
                  </div>
                </div>
              </div>
            ) : <div style={{opacity:.8}}>Nothing playing</div>
          ) : (
            <button onClick={connectSpotify}>Connect Spotify</button>
          )}
          <button onClick={newSession} style={{background:'#1f1f1f', border:'1px solid #333', color:'#fff', borderRadius:8, padding:'8px 12px'}}>New Session</button>
        </div>

        {/* Who liked (avatars) */}
        {!!likedUsers.length && (
          <div style={{display:'flex',flexWrap:'wrap',justifyContent:'center',gap:14,marginBottom:12}}>
            {likedUsers.map(name => {
              const a = avatarFor(name)
              return (
                <div key={name} title={name} style={{textAlign:'center'}}>
                  <div style={{width:52,height:52,borderRadius:'50%',background:a.bg,display:'grid',placeItems:'center',fontWeight:800,fontSize:20}}>
                    {a.initial}
                  </div>
                  <div style={{fontSize:12,opacity:.85,marginTop:4}}>{name}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* QR always visible */}
        <canvas ref={canvasRef} style={{width:'60vmin',height:'60vmin',background:'#fff',padding:'2vmin',borderRadius:'2vmin'}} />
        <div style={{ marginTop:12, opacity:.85 }}>Scan to join</div>
        <div style={{ marginTop:6, fontSize:'1.8vmin', opacity:.6 }}>SID: {sid}</div>

        {/* Currently logged in (presence-based) + kick */}
        <h2 style={{ marginTop:18, fontSize:'2.4vmin' }}>Currently logged in users</h2>
        <div style={{opacity:.6, fontSize:12, marginBottom:6}}>(active in last 30s)</div>
        {err && <div style={{color:'#ff6b6b', fontSize:'2vmin', marginBottom:8}}>Error: {err}</div>}
        <ul style={{ listStyle:'none', padding:0, margin:'0 auto', maxWidth:560, fontSize:'2.2vmin' }}>
          {activeOnly(members).length ? activeOnly(members).map(m => (
            <li key={m.username} style={{display:'flex',alignItems:'center',justifyContent:'space-between',
              padding:'8px 12px', margin:'6px 0', background:'#111', borderRadius:10}}>
              <span>{m.username}</span>
              <button onClick={() => removeMember(m.username)} style={{background:'#2b2b2b', color:'#fff', border:'1px solid #333',
                borderRadius:8, padding:'4px 10px', cursor:'pointer'}}>Remove</button>
            </li>
          )) : <li>None online</li>}
        </ul>
      </div>
    </main>
  )
}

