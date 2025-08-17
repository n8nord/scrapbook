import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function Host() {
  // ----- existing session + roster logic -----
  const canvasRef = useRef(null)
  const [sid] = useState(() => crypto.randomUUID())
  const [members, setMembers] = useState([])

  // live domain + hash route
  const base = 'https://scrapbook-ggi2.vercel.app'
  const joinUrl = `${base}/#/join?sid=${sid}`

  useEffect(() => {
    QRCode.toCanvas(canvasRef.current, joinUrl, { errorCorrectionLevel: 'M' })
  }, [joinUrl])

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('members')
        .select('username,favorite')
        .eq('sid', sid)
        .order('joined_at', { ascending: true })
      setMembers(data || [])
    })()
  }, [sid])

  useEffect(() => {
    const channel = supabase
      .channel('members-realtime-host')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members', filter: `sid=eq.${sid}` },
        async () => {
          const { data } = await supabase
            .from('members')
            .select('username,favorite')
            .eq('sid', sid)
            .order('joined_at', { ascending: true })
          setMembers(data || [])
        }
      ).subscribe()
    return () => supabase.removeChannel(channel)
  }, [sid])

  async function kick(username) {
    await supabase.from('members').delete().eq('sid', sid).eq('username', username)
  }

  // ----- cube / swipe state -----
  const [active, setActive] = useState(0) // 0 = Screen 1 (QR/Roster), 1 = Screen 2 (Music)
  const startX = useRef(null)
  const dragging = useRef(false)

  function goto(idx) {
    setActive((idx + 2) % 2) // only 2 screens for now
  }
  function onPointerDown(e) {
    dragging.current = true
    startX.current = (e.touches?.[0]?.clientX ?? e.clientX)
  }
  function onPointerMove(e) {
    if (!dragging.current) return
    // we only act on release; keeping this for future live-drag
  }
  function onPointerUp(e) {
    if (!dragging.current) return
    dragging.current = false
    const endX = (e.changedTouches?.[0]?.clientX ?? e.clientX)
    const dx = endX - (startX.current ?? endX)
    const THRESH = 50
    if (dx > THRESH) goto(active - 1)   // swipe right → previous
    else if (dx < -THRESH) goto(active + 1) // swipe left → next
  }

  // styles
  const pageStyle = {
    display:'grid', placeItems:'center', height:'100vh',
    background:'#000', color:'#fff', fontFamily:'system-ui',
    touchAction:'pan-y' // allow horizontal swipes
  }

  // cube sizing with CSS var
  const cubeWrapStyle = {
    '--size': '78vmin',
    width: 'var(--size)',
    height: 'var(--size)',
    perspective: '1400px',
    position: 'relative',
    userSelect: 'none'
  }
  const cubeStyle = {
    width: '100%', height: '100%',
    position: 'relative',
    transformStyle: 'preserve-3d',
    transition: 'transform 600ms cubic-bezier(.2,.8,.2,1)',
    transform: `translateZ(calc(var(--size) / -2)) rotateY(${active * -90}deg)`
  }
  const faceBase = {
    position:'absolute', width:'100%', height:'100%',
    display:'grid', placeItems:'center',
    backfaceVisibility:'hidden'
  }
  const faceFront = {
    ...faceBase,
    transform: 'rotateY(0deg) translateZ(calc(var(--size) / 2))'
  }
  const faceRight = {
    ...faceBase,
    transform: 'rotateY(90deg) translateZ(calc(var(--size) / 2))'
  }

  const btnNav = {
    position:'absolute', top:'50%', transform:'translateY(-50%)',
    background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.2)',
    color:'#fff', padding:'8px 12px', borderRadius:12, fontSize:'14px'
  }

  return (
    <main
      style={pageStyle}
      onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp}
      onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}
    >
      <div style={{position:'relative'}}>
        {/* Cube nav buttons */}
        <button style={{...btnNav, left:'-72px'}} onClick={() => goto(active - 1)}>‹</button>
        <button style={{...btnNav, right:'-72px'}} onClick={() => goto(active + 1)}>›</button>

        {/* Cube wrapper */}
        <div style={cubeWrapStyle}>
          <div style={cubeStyle}>
            {/* Screen 1: QR + Roster (your current screen) */}
            <section style={faceFront}>
              <div style={{textAlign:'center', width:'100%'}}>
                <canvas
                  ref={canvasRef}
                  style={{
                    width:'56vmin', height:'56vmin',
                    background:'#fff', padding:'2vmin', borderRadius:'2vmin', margin:'0 auto'
                  }}
                />
                <div style={{ marginTop:12, opacity:.85, fontSize:'2.2vmin' }}>Scan to join</div>

                <h2 style={{ marginTop:20, fontSize:'2.4vmin' }}>Currently logged in users:</h2>
                <ul style={{ listStyle:'none', padding:0, margin:0, fontSize:'2.2vmin' }}>
                  {members.length === 0
                    ? <li>None yet</li>
                    : members.map(m => (
                        <li key={m.username} style={{margin:'8px 0', display:'flex', gap:12, justifyContent:'center', alignItems:'center'}}>
                          <span>{m.username}</span>
                          <button
                            onClick={() => kick(m.username)}
                            style={{fontSize:'1.8vmin', padding:'4px 10px', borderRadius:8, border:'1px solid #f77', background:'#200', color:'#f88'}}
                            title="Remove this user from the session"
                          >
                            Kick out
                          </button>
                        </li>
                      ))
                  }
                </ul>

                <div style={{ marginTop:14, opacity:.5, fontSize:'1.8vmin' }}>{joinUrl}</div>
              </div>
            </section>

            {/* Screen 2: Music-themed placeholder */}
            <section style={faceRight}>
              <div
                style={{
                  width:'100%', height:'100%', display:'grid',
                  gridTemplateRows:'auto auto 1fr', padding:'4vmin',
                  background: 'linear-gradient(135deg, #0a0a0a 0%, #151515 100%)',
                  boxShadow: 'inset 0 0 120px rgba(255,255,255,0.04)',
                  borderRadius:'2vmin'
                }}
              >
                <header style={{textAlign:'center', marginBottom:'2vmin'}}>
                  <div style={{fontSize:'2.6vmin', opacity:.85, letterSpacing:'.08em'}}>Now Playing</div>
                  <div style={{fontSize:'1.8vmin', opacity:.6}}>(placeholder)</div>
                </header>

                <div style={{display:'grid', gap:'1.6vmin', alignContent:'start'}}>
                  <div style={{fontSize:'2.4vmin'}}>Currently playing: <span style={{opacity:.8}}>— track title —</span></div>
                  <div style={{fontSize:'2.2vmin'}}>Artist: <span style={{opacity:.8}}>— artist —</span></div>
                  <div style={{fontSize:'2.2vmin'}}>Album: <span style={{opacity:.8}}>— album —</span></div>
                  <div style={{fontSize:'2.2vmin', marginTop:'1vmin'}}>From: <span style={{opacity:.8}}>— username / playlist owner —</span></div>
                </div>

                <footer style={{alignSelf:'end', textAlign:'center', opacity:.5, fontSize:'1.8vmin', marginTop:'2vmin'}}>
                  Swipe ◀ / ▶ to switch screens
                </footer>
              </div>
            </section>
          </div>
        </div>

        {/* Tiny pager dots */}
        <div style={{display:'flex', gap:8, justifyContent:'center', marginTop:16}}>
          {[0,1].map(i => (
            <span key={i}
              onClick={() => setActive(i)}
              style={{
                width:10, height:10, borderRadius:999,
                background: i===active ? '#fff' : 'rgba(255,255,255,.3)',
                cursor:'pointer'
              }}
            />
          ))}
        </div>
      </div>
    </main>
  )
}

