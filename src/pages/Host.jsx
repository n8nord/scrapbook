import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

export default function Host() {
  const canvasRef = useRef(null)
  const [sid] = useState(() => crypto.randomUUID())
  const joinUrl = `${location.origin}/join?sid=${sid}`
  const [members, setMembers] = useState([])

  useEffect(() => {
    const draw = () => QRCode.toCanvas(canvasRef.current, joinUrl)
    draw()
  }, [joinUrl])

  useEffect(() => {
    const key = `session:${sid}:members`
    const interval = setInterval(() => {
      const existing = JSON.parse(localStorage.getItem(key) || '[]')
      setMembers(existing)
    }, 2000)
    return () => clearInterval(interval)
  }, [sid])

  return (
    <main style={{display:'grid',placeItems:'center',height:'100vh',background:'#000',color:'#fff'}}>
      <div style={{textAlign:'center'}}>
        <canvas ref={canvasRef} style={{width:'60vmin',height:'60vmin',background:'#fff',padding:'2vmin',borderRadius:'2vmin'}}/>
        <div style={{marginTop:16,opacity:.8}}>Scan to join</div>
        <h2 style={{marginTop:24}}>Currently logged in users:</h2>
        <ul style={{listStyle:'none', padding:0}}>
          {members.map(m => (
            <li key={m.username}>{m.username}</li>
          ))}
          {members.length === 0 && <li>None yet</li>}
        </ul>
      </div>
    </main>
  )
}

