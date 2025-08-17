import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function Join() {
  const [sp] = useSearchParams()
  const sid = sp.get('sid') || 'demo-session'

  const [mode, setMode] = useState('menu') // menu | signup | login | joined
  const [username, setUsername] = useState('')
  const [passcode, setPasscode] = useState('')
  const [favorite, setFavorite] = useState('')
  const [currentUser, setCurrentUser] = useState(null)

  // now playing + my likes
  const [now, setNow] = useState(null)
  const [myLikes, setMyLikes] = useState([])
  const [err, setErr] = useState('')
  const [members, setMembers] = useState([])

  // roster
  async function refreshMembers() {
    const { data } = await supabase.from('members').select('username').eq('sid', sid).order('joined_at', { ascending: true })
    setMembers(data || [])
  }

  // autologin + load lists
  useEffect(() => {
    (async () => {
      const me = JSON.parse(localStorage.getItem('currentUser') || 'null')
      if (me && me.sid === sid) { setCurrentUser(me); setMode('joined') }
      await refreshMembers()
      await refreshNow(); await refreshLikes()
    })()
    // realtime now_playing subscription
    const ch = supabase.channel('np-live')
      .on('postgres_changes', { event:'*', schema:'public', table:'now_playing', filter:`sid=eq.${sid}` },
        () => refreshNow())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid])

  async function refreshNow(){
    const { data } = await supabase.from('now_playing').select('*').eq('sid', sid).single()
    setNow(data || null)
  }
  async function refreshLikes(){
    if (!currentUser) return setMyLikes([])
    const { data } = await supabase
      .from('liked_songs')
      .select('uri,title,artist,artwork,liked_at')
      .eq('sid', sid).eq('username', currentUser.username)
      .order('liked_at', { ascending:false })
    setMyLikes(data || [])
  }

  async function addMember(user) {
    await supabase.from('members').upsert({ sid, username: user.username, favorite: user.favorite || null })
    await refreshMembers()
  }
  async function removeMember(name) {
    await supabase.from('members').delete().eq('sid', sid).eq('username', name)
    await refreshMembers()
  }

  async function signUp() {
    if (!username || !passcode) return alert('Need username + passcode')
    const user = { username, passcode, favorite, sid }
    localStorage.setItem(`user:${username}`, JSON.stringify(user))
    localStorage.setItem('currentUser', JSON.stringify(user))
    setCurrentUser(user); await addMember(user); setMode('joined'); await refreshLikes()
  }
  async function logIn() {
    const raw = localStorage.getItem(`user:${username}`)
    if (!raw) return alert('No such user')
    const user = JSON.parse(raw)
    if (user.passcode !== passcode) return alert('Wrong passcode')
    user.sid = sid
    localStorage.setItem('currentUser', JSON.stringify(user))
    setCurrentUser(user); await addMember(user); setMode('joined'); await refreshLikes()
  }
  async function leave() {
    if (!currentUser) return
    await removeMember(currentUser.username)
    localStorage.removeItem('currentUser')
    setCurrentUser(null); setMode('menu')
  }

  async function likeCurrent() {
    if (!currentUser) return alert('Log in first')
    if (!now) return alert('Nothing playing')
    setErr('')
    const { error } = await supabase.from('liked_songs').upsert({
      sid,
      username: currentUser.username,
      uri: now.uri,
      title: now.title,
      artist: now.artist,
      artwork: now.artwork
    })
    if (error) setErr(error.message)
    await refreshLikes()
  }

  // ---------- UI ----------
  if (mode === 'menu') {
    return (
      <main style={{ padding:24, fontFamily:'system-ui' }}>
        <h1>Join Session</h1>
        <p>Session: {sid}</p>
        <button onClick={() => setMode('signup')}>Sign Up</button>
        <button onClick={() => setMode('login')} style={{ marginLeft:12 }}>Log In</button>

        <h2 style={{ marginTop:24 }}>Currently logged in users:</h2>
        <ul>{members.length ? members.map(m => <li key={m.username}>{m.username}</li>) : <li>None yet</li>}</ul>
      </main>
    )
  }

  if (mode === 'signup') {
    return (
      <main style={{ padding:24, fontFamily:'system-ui' }}>
        <h1>Sign Up</h1>
        <input placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} /><br/>
        <input placeholder="4-digit passcode" value={passcode} onChange={e=>setPasscode(e.target.value)} /><br/>
        <input placeholder="Favorite song" value={favorite} onChange={e=>setFavorite(e.target.value)} /><br/>
        <button onClick={signUp}>Create Account</button>
        <button onClick={() => setMode('menu')} style={{ marginLeft:12 }}>Cancel</button>
      </main>
    )
  }

  if (mode === 'login') {
    return (
      <main style={{ padding:24, fontFamily:'system-ui' }}>
        <h1>Log In</h1>
        <input placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} /><br/>
        <input placeholder="4-digit passcode" value={passcode} onChange={e=>setPasscode(e.target.value)} /><br/>
        <button onClick={logIn}>Log In</button>
        <button onClick={() => setMode('menu')} style={{ marginLeft:12 }}>Cancel</button>
      </main>
    )
  }

  if (mode === 'joined') {
    return (
      <main style={{ padding:24, fontFamily:'system-ui' }}>
        <h1>Welcome, {currentUser.username} 🎉</h1>

        <section style={{marginTop:12, padding:12, border:'1px solid #ddd', borderRadius:10}}>
          <h2>Now Playing</h2>
          {now ? (
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              {now.artwork && <img src={now.artwork} width="64" height="64" style={{borderRadius:8,objectFit:'cover'}} />}
              <div style={{flex:1}}>
                <div style={{fontWeight:700}}>{now.title}</div>
                <div style={{opacity:.8}}>{now.artist}</div>
              </div>
              <button onClick={likeCurrent}>👍 Like</button>
            </div>
          ) : <div>Waiting for host…</div>}
          {err && <div style={{color:'#c00', marginTop:8}}>Error: {err}</div>}
        </section>

        <section style={{marginTop:16}}>
          <h2>My Liked Songs</h2>
          {myLikes.length ? (
            <ul style={{paddingLeft:16}}>
              {myLikes.map((t,i)=>(
                <li key={t.uri+i} style={{margin:'6px 0'}}>
                  {t.title} — <span style={{opacity:.8}}>{t.artist}</span>
                </li>
              ))}
            </ul>
          ) : <div>No likes yet.</div>}
        </section>

        <button onClick={leave} style={{marginTop:18}}>Left Vehicle</button>
      </main>
    )
  }
}

