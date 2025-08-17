// api/spotify/callback.js
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`)
    const code = url.searchParams.get('code')
    const verifier = url.searchParams.get('code_verifier') // we’ll pass it along

    if (!code || !verifier) {
      return res.status(400).json({ error: 'Missing code or code_verifier' })
    }

    const params = new URLSearchParams({
      client_id: process.env.SPOTIFY_CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
      code_verifier: verifier,
    })

    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const tokens = await tokenRes.json()
    if (!tokenRes.ok) return res.status(500).json(tokens)

    // Simple HTML to bounce tokens back to the SPA via postMessage
    res.setHeader('Content-Type', 'text/html')
    return res.end(`
      <script>
        window.opener && window.opener.postMessage(${JSON.stringify(tokens)}, '*');
        window.close();
      </script>
    `)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

