import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function Host() {
  const canvasRef = useRef(null)
  const [sid] = useState(() => crypto.randomUUID())
  const [members, setMembers] = useState([])
  const [err, setErr] = useState('')
  const base = "https://scrapbook-ggi2.vercel.app"
  const joinUrl = `${base}/#/join?sid=${sid}`

  // draw QR
  useEffect(() => {
    QRCode.toCanvas(canvasRef.current, joinUrl, { errorCorrectionLevel: 'M' })
  }, [joinUrl])

  async function fetchMembers() {
    const { data, error } = await supabase
      .from('members')
      .select('username,favorite')
      .eq('sid', sid)
      .order('joined_at', { ascending: true })
    if (error) {
      console.error('Supabase select error:', error)
      setErr(error.message)
      return
    }
    setMembers(data || [])
  }

  // initial load
  useEffect(() => { fetchMembers() }, [sid])

  // realtime subscribe (if not configured, polling still keeps it fresh)
  useEffect(() => {
    const channel = supabase
      .channel('members-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members', filter: `sid=eq.${sid}` },
        () => fetchMembers()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sid])

  // polling fallback every 2s
  useEffect(() => {
    const id = setInterval(fetchMembers, 2000)
    return () => clearInterval(id)
  }, [sid])

  return (
    <main style={{display:'grid',placeItems:'center',height:'100vh',background:'#000',color:'#fff',fontFamily:'system-ui'}}>
      <div style={{ textAlign:'center', maxWidth:900 }}>
        <canvas ref={canvasRef} style={{width:'60vmin',height:'60vmin',background:'#fff',padding:'2vmin',borderRadius:'2vmin'}} />
        <div style={{ marginTop:12, opacity:.85 }}>Scan to join</div>

        <div style={{marginTop:8, fontSize:'1.8vmin', opacity:.6}}>
          SID: {sid}
        </div>

        <h2 style={{ marginTop:24, fontSize:'2.4vmin' }}>Currently logged in users:</h2>
        {err && <div style={{color:'#ff6b6b', fontSize:'2vmin'}}>Error: {err}</div>}
        <ul style={{ listStyle:'none', padding:0, margin:0, fontSize:'2.2vmin' }}>
          {members.length === 0 ? <li>None yet</li> :
            members.map(m => <li key={m.username}>{m.username}</li>)
          }
        </ul>

        <div style={{ marginTop:16, opacity:.5, fontSize:'1.8vmin' }}>{joinUrl}</div>
      </div>
    </main>
  )
}

