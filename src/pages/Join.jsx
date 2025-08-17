import { useState, useEffect } from 'react'
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
  const [members, setMembers] = useState([])
  const [err, setErr] = useState('')

  async function refreshMembers() {
    const { data, error } = await supabase
      .from('members')
      .select('username,favorite')
      .eq('sid', sid)
      .order('joined_at', { ascending: true })
    if (error) { console.error(error); setErr(error.message) }
    setMembers(data || [])
  }

  // load roster + autologin
  useEffect(() => {
    (async () => {
      const me = JSON.parse(localStorage.getItem('currentUser') || 'null')
      if (me && me.sid === sid) { setCurrentUser(me); setMode('joined') }
      await refreshMembers()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid])

  async function addMember(user) {
    setErr('')
    const { error } = await supabase.from('members').upsert({
      sid,
      username: user.username,
      favorite: user.favorite || null
    })
    if (error) { console.error('upsert error:', error); setErr(error.message) }
    await refreshMembers()
  }

  async function removeMember(name) {
    setErr('')
    const { error } = await supabase.from('members').delete().eq('sid', sid).eq('username', name)
    if (error) { console.error('delete error:', error); setErr(error.message) }
    await refreshMembers()
  }

  async function signUp() {
    if (!username || !passcode) return alert('Need username + passcode')
    const user = { username, passcode, favorite, sid }
    localStorage.setItem(`user:${username}`, JSON.stringify(user))
    localStorage.setItem('currentUser', JSON.stringify(user))
    setCurrentUser(user)
    await addMember(user)
    setMode('joined')
  }

  async function logIn() {
    const raw = localStorage.getItem(`user:${username}`)
    if (!raw) return alert('No such user')
    const user = JSON.parse(raw)
    if (user.passcode !== passcode) return alert('Wrong passcode')
    user.sid = sid
    localStorage.setItem('currentUser', JSON.stringify(user))
    setCurrentUser(user)
    await addMember(user)
    setMode('joined')
  }

  async function leave() {
    if (!currentUser) return
    await removeMember(currentUser.username)
    localStorage.removeItem('currentUser')
    setCurrentUser(null)
    setMode('menu')
  }

  // UI
  if (mode === 'menu') {
    return (
      <main style={{ padding:24, fontFamily:'system-ui' }}>
        <h1>Join Session</h1>
        <p>Session: {sid}</p>
        <button onClick={() => setMode('signup')}>Sign Up</button>
        <button onClick={() => setMode('login')} style={{ marginLeft:12 }}>Log In</button>

        <h2 style={{ marginTop:24 }}>Currently logged in users:</h2>
        {err && <div style={{color:'#c00'}}>Error: {err}</div>}
        <ul>
          {members.length ? members.map(m => <li key={m.username}>{m.username}</li>) : <li>None yet</li>}
        </ul>
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
        {err && <div style={{marginTop:12, color:'#c00'}}>Error: {err}</div>}
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
        {err && <div style={{marginTop:12, color:'#c00'}}>Error: {err}</div>}
      </main>
    )
  }

  if (mode === 'joined') {
    return (
      <main style={{ padding:24, fontFamily:'system-ui' }}>
        <h1>Welcome, {currentUser.username} 🎉</h1>
        <p>Favorite song: {currentUser.favorite || '(none)'} </p>
        <button onClick={leave}>Left Vehicle</button>

        <h2 style={{ marginTop:24 }}>Currently logged in users:</h2>
        {err && <div style={{color:'#c00'}}>Error: {err}</div>}
        <ul>
          {members.map(m => (
            <li key={m.username}>
              {m.username} {m.username === currentUser.username && '(You)'}
            </li>
          ))}
        </ul>
      </main>
    )
  }
}

