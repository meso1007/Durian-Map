// src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// CORSの設定（Next.jsからのアクセスを許可）
app.use('/api/*', cors())

// --- 型定義 ---
type Place = {
  id: string;
  displayName: { text: string };
  formattedAddress: string;
  primaryType: string;
  websiteUri?: string;
}

app.get('/api/search', async (c) => {
  const area = c.req.query('area')
  const category = c.req.query('category')

  if (!area || !category) {
    return c.json({ error: 'Area and category are required' }, 400)
  }

  // ★環境変数からAPIキーを取得
  const apiKey = Bun.env.GOOGLE_API_KEY

  if (!apiKey) {
    console.error('Missing GOOGLE_API_KEY in .env')
    return c.json({ error: 'Server configuration error' }, 500)
  }

  const query = `${area} ${category}`
  const apiUrl = 'https://places.googleapis.com/v1/places:searchText'

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey, // ★ここで環境変数のキーを使用
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.primaryType,places.websiteUri'
      },
      body: JSON.stringify({ textQuery: query })
    })

    const data = await response.json()
    const places: Place[] = data.places || []

    // 独自のフィルタリングロジック（自社サイト持ちを弾く）
    const leads = places.reduce((acc: any[], place) => {
      const status = determineWebsiteStatus(place.websiteUri)

      if (status !== 'Has Website') {
        acc.push({
          id: place.id,
          name: place.displayName.text,
          address: place.formattedAddress,
          category: category,
          status: status
        })
      }
      return acc
    }, [])

    return c.json({ leads })

  } catch (error) {
    console.error(error)
    return c.json({ error: 'Failed to fetch places' }, 500)
  }
})

// --- ウェブサイトの有無を判定する関数 ---
function determineWebsiteStatus(url?: string): string {
  if (!url) return 'No Website'

  const lowerUrl = url.toLowerCase()
  const snsDomains = [
    'instagram.com', 'tabelog.com', 'facebook.com',
    'twitter.com', 'x.com', 'hotpepper.jp', 'line.me', 'beauty.hotpepper.jp'
  ]

  const isSnsOnly = snsDomains.some(domain => lowerUrl.includes(domain))
  return isSnsOnly ? 'SNS Only' : 'Has Website'
}

export default {
  port: 8080,
  fetch: app.fetch,
}