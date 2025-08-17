import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

export default function Join() {
  const [sp] = useSearchParams()
  const sid = sp.get('sid') || 'demo-session'

  const [mode, setMode] = useState('menu') // menu | signup | login | joined
  const [username, setUsername] = useState('')
  const [passcode, setPasscode] = useState('')
  const [favorite, setFavorite] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [members, setMembers] = useState([])

  // Load session roster + auto-login
  useEffect(() => {
    const me = JSON.parse(localStorage.getItem('currentUser') || 'null')
    if (me && me.sid === sid) {
      setCurrentUser(me)
      setMode('joined')
    }
    refreshMembers()
  }, [sid])

  function refreshMembers() {
    const key = `session:${sid}:members`
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    setMembers(existing)
  }

  function saveMember(user) {
    const key = `session:${sid}:members`
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    const newList = [...existing.filter(m => m.username !== user.username), user]
    localStorage.setItem(key, JSON.stringify(newList))
    setMembers(newList)
  }

  function removeMember(username) {
    const key = `session:${sid}:members`
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    const newList = existing.filter(m => m.username !== username)
    localStorage.setItem(key, JSON.stringify(newList))
    setMembers(newList)
  }

  function signUp() {
    if (!username || !passcode) return alert('Need username + passcode')
    const user = { username, passcode, favorite, sid }
    localStorage.setItem(`user:${username}`, JSON.stringify(user))
    localStorage.setItem('currentUser', JSON.stringify(user))
    setCurrentUser(user)
    saveMember(user)
    setMode('joined')
  }

  function logIn() {
    const raw = localStorage.getItem(`user:${username}`)
    if (!raw) return alert('No such user')
    const user = JSON.parse(raw)
    if (user.passcode !== passcode) return alert('Wrong passcode')
    user.sid = sid
    localStorage.setItem('currentUser', JSON.stringify(user))
    setCurrentUser(user)
    saveMember(user)
    setMode('joined')
  }

  function leave() {
    if (!currentUser) return
    removeMember(currentUser.username)
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
        <button onClick={() => setMode('login')} style={{marginLeft:12}}>Log In</button>

        <h2 style={{marginTop:24}}>Currently logged in users:</h2>
        <ul>
          {members.map(m => (
            <li key={m.username}>{m.username}</li>
          ))}
          {members.length === 0 && <li>None yet</li>}
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
        <button onClick={() => setMode('menu')} style={{marginLeft:12}}>Cancel</button>
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
        <button onClick={() => setMode('menu')} style={{marginLeft:12}}>Cancel</button>
      </main>
    )
  }

  if (mode === 'joined') {
    return (
      <main style={{ padding:24, fontFamily:'system-ui' }}>
        <h1>Welcome, {currentUser.username} 🎉</h1>
        <p>Favorite song: {currentUser.favorite || '(none)'} </p>
        <button onClick={leave}>Left Vehicle</button>

        <h2 style={{marginTop:24}}>Currently logged in users:</h2>
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

