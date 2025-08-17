// api/spotify/search.js
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`)
    const q = url.searchParams.get('q') || ''
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Missing access token' })
    if (!q)   return res.status(400).json({ error: 'Missing q' })

    const sp = new URL('https://api.spotify.com/v1/search')
    sp.searchParams.set('q', q)
    sp.searchParams.set('type', 'track')
    sp.searchParams.set('limit', '10')

    const r = await fetch(sp.toString(), {
      headers: { Authorization: `Bearer ${token}` }
    })
    const json = await r.json()
    if (!r.ok) return res.status(r.status).json(json)
    res.status(200).json(json)
  } catch (e) { res.status(500).json({ error: e.message }) }
}

