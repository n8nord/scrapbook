// api/spotify/queue.js
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Missing access token' })

    const chunks = []
    for await (const c of req) chunks.push(c)
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    const { uri } = body || {}
    if (!uri) return res.status(400).json({ error: 'Missing uri' })

    const sp = new URL('https://api.spotify.com/v1/me/player/queue')
    sp.searchParams.set('uri', uri)

    const r = await fetch(sp.toString(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!r.ok) {
      const t = await r.text()
      return res.status(r.status).json({ error: 'Spotify error', details: t })
    }
    res.status(204).end()
  } catch (e) { res.status(500).json({ error: e.message }) }
}

