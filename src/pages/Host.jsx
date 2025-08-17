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

  // your live domain (hash route so vercel SPA works)
  const base = 'https://scrapbook-ggi2.vercel.app'
  const joinUrl = `${base}/#/join?sid=${sid}`

  // draw QR
  useEffect(() => {
    QRCode.toCanvas(canvasRef.current, joinUrl, { errorCorrectionLevel: 'M' })
  }, [joinUrl])

  // initial load
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('members')
        .select('username,favorite')
        .eq('sid', sid)
        .order('joined_at', { ascending: true })
      if (!error) setMembers(data || [])
    })()
  }, [sid])

  // realtime: any change to this session -> refresh list
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
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [sid])

  async function kick(username) {
    await supabase.from('members').delete().eq('sid', sid).eq('username', username)
    // realtime subscription will refresh the list for us
  }

  return (
    <main style={{display:'grid',placeItems:'center',height:'100vh',background:'#000',color:'#fff',fontFamily:'system-ui'}}>
      <div style={{ textAlign:'center' }}>
        <canvas ref={canvasRef} style={{width:'60vmin',height:'60vmin',background:'#fff',padding:'2vmin',borderRadius:'2vmin'}} />
        <div style={{ marginTop:12, opacity:.85 }}>Scan to join</div>

        <h2 style={{ marginTop:24, fontSize:'2.4vmin' }}>Currently logged in users:</h2>
        {members.length === 0 ? (
          <div style={{fontSize:'2.2vmin'}}>None yet</div>
        ) : (
          <ul style={{ listStyle:'none', padding:0, margin:0, fontSize:'2.2vmin' }}>
            {members.map(m => (
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
            ))}
          </ul>
        )}

        <div style={{ marginTop:16, opacity:.5, fontSize:'1.8vmin' }}>{joinUrl}</div>
      </div>
    </main>
  )
}

