import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

export default function Host() {
  const canvasRef = useRef(null)
  const [sid] = useState(() => crypto.randomUUID())
  const [members, setMembers] = useState([])

  // Hard-coded deployed base URL
  const base = "https://scrapbook-ggi2.vercel.app"
  const joinUrl = `${base}/#/join?sid=${sid}`

  // Render QR code
  useEffect(() => {
    const draw = () =>
      QRCode.toCanvas(canvasRef.current, joinUrl, { errorCorrectionLevel: 'M' })
    draw()
    const id = setInterval(draw, 10000) // refresh occasionally
    return () => clearInterval(id)
  }, [joinUrl])

  // Poll roster from localStorage (demo-mode)
  useEffect(() => {
    const key = `session:${sid}:members`
    const tick = () => {
      const list = JSON.parse(localStorage.getItem(key) || '[]')
      setMembers(list)
    }
    tick()
    const id = setInterval(tick, 1500)
    return () => clearInterval(id)
  }, [sid])

  return (
    <main
      style={{
        display: 'grid',
        placeItems: 'center',
        height: '100vh',
        background: '#000',
        color: '#fff',
        fontFamily: 'system-ui'
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '60vmin',
            height: '60vmin',
            background: '#fff',
            padding: '2vmin',
            borderRadius: '2vmin'
          }}
        />
        <div style={{ marginTop: 12, opacity: 0.85 }}>Scan to join</div>

        <h2 style={{ marginTop: 24, fontSize: '2.4vmin' }}>
          Currently logged in users:
        </h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '2.2vmin' }}>
          {members.length === 0 ? (
            <li>None yet</li>
          ) : (
            members.map((m) => <li key={m.username}>{m.username}</li>)
          )}
        </ul>

        {/* Debug line shows where QR points */}
        <div style={{ marginTop: 16, opacity: 0.5, fontSize: '1.8vmin' }}>
          {joinUrl}
        </div>
      </div>
    </main>
  )
}

