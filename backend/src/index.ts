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
  location?: { latitude: number; longitude: number };
}

// --- チェーン店ブロックリスト（全国30店舗以上が基準）---

// 店舗名で判定するリスト（部分一致）
const chainCafeNames = [
  // 大手コーヒーチェーン（500店舗以上）
  'スターバックス', 'starbucks',
  'ドトール',
  'コメダ', 'komeda',
  'ミスタードーナツ', 'mister donut', 'misdo',
  'タリーズ', "tully's", 'tullys',
  '上島珈琲',

  // 中堅チェーン（100〜499店舗）
  'プロント', 'pronto',
  'サンマルクカフェ', 'saint marc',
  '星乃珈琲',
  'ヴィ・ド・フランス', 'vie de france',
  '珈琲館',
  'ゴンチャ', 'gong cha',
  'カフェ・ド・クリエ', 'cafe de crie',
  'ベローチェ', 'veloce',
  'エクセルシオール', 'excelsior',
  'イタリアントマト', 'italian tomato',
  'リンツ', 'lindt',
  'ホリーズカフェ', "holly's",
  'ルノアール',

  // 小〜中規模チェーン（30〜99店舗）
  'クリスピークリーム', 'krispy kreme',
  'むさしの森珈琲',
  'サンジェルマン', 'saint germain',
  'ベックスコーヒー', "beck's coffee",
  'ナナズグリーンティー', "nana's green tea",
  '珈琲屋らんぷ',
  'シアトルズベストコーヒー', "seattle's best",
  'アフタヌーンティー', 'afternoon tea',
  'キーズカフェ',
  '喫茶室ルノアール',
  '椿屋珈琲',
  '倉式珈琲',
  'ディーン&デルーカ', 'dean & deluca', 'dean&deluca',
  'コナズ珈琲',
  'さかい珈琲',
  '支留比亜珈琲', 'シルビア珈琲',
  '高倉町珈琲',
  'やなか珈琲',
  'パンとエスプレッソと',
  '猫カフェmocha', 'cat cafe mocha',

  // ファストフード・コンビニ系（カフェ需要で検索にヒットする場合）
  'マクドナルド', 'mcdonald',
  'モスバーガー', 'mos burger',
  'ケンタッキー', 'kfc',
  'セブン-イレブン', 'セブンイレブン', '7-eleven',
  'ファミリーマート', 'familymart',
  'ローソン', 'lawson',
]

// ウェブサイトのドメインで判定するリスト
const chainCafeDomains = [
  // 大手
  'starbucks.co.jp',
  'tullys.co.jp',
  'doutor.co.jp',
  'komeda.co.jp',
  'misterdonut.jp',
  'ueshima-coffee-ten.jp',
  'ucc.co.jp',

  // 中堅
  'pronto.co.jp',
  'saint-marc-hd.com',
  'hoshinocoffee.com',
  'viedefrance.co.jp',
  'c-united.co.jp',       // 珈琲館・カフェ・ド・クリエ・ベローチェ共通
  'gongcha.co.jp',
  'italian-tomato.co.jp',
  'lindt.co.jp',
  'hollys-corp.jp',
  'ginza-renoir.co.jp',

  // 小〜中規模
  'krispykreme.co.jp',
  'skylark.co.jp',        // むさしの森珈琲（すかいらーく系）
  'st-germain.jp',
  'becks.co.jp',
  'nanasgreentea.com',
  'ranpu.co.jp',
  'afternoon-tea.net',
  'towafood-net.co.jp',   // 椿屋珈琲
  'deandeluca.co.jp',
  'toridoll.com',         // コナズ珈琲（トリドール系）
  'sakaikohiten.com',
  'sirubia.com',
  'takakuramachi-coffee.co.jp',
  'yanaka-coffee.co.jp',
  'bread-espresso.jp',
  'catmocha.jp',

  // ファストフード・コンビニ
  'mcdonalds.co.jp',
  'mos.co.jp',
  'kfc.co.jp',
  'sej.co.jp',
  'family.co.jp',
  'lawson.co.jp',
]

app.get('/api/search', async (c) => {
  const area = c.req.query('area')
  const category = c.req.query('category')

  if (!area || !category) {
    return c.json({ error: 'Area and category are required' }, 400)
  }

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
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.primaryType,places.websiteUri,places.location'
      },
      body: JSON.stringify({ textQuery: query })
    })

    const data = await response.json()
    const places: Place[] = data.places || []

    // チェーン店を除外し、独立系カフェのみ返す
    const leads = places.reduce((acc: any[], place) => {
      if (!isChainCafe(place.displayName.text, place.websiteUri)) {
        acc.push({
          id: place.id,
          name: place.displayName.text,
          address: place.formattedAddress,
          category: category,
          websiteUri: place.websiteUri,
          lat: place.location?.latitude,
          lng: place.location?.longitude,
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

// --- チェーン店かどうかを判定する関数 ---
function isChainCafe(name: string, websiteUri?: string): boolean {
  const lowerName = name.toLowerCase()
  const lowerUrl = websiteUri?.toLowerCase() ?? ''

  const nameMatch = chainCafeNames.some(chain => lowerName.includes(chain.toLowerCase()))
  const domainMatch = chainCafeDomains.some(domain => lowerUrl.includes(domain))

  return nameMatch || domainMatch
}

// --- ウェブサイトの状態を分類する関数（表示用） ---
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