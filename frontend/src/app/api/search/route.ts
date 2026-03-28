import { NextResponse } from 'next/server';

type Place = {
    id: string;
    displayName: { text: string };
    formattedAddress: string;
    primaryType: string;
    websiteUri?: string;
    location?: { latitude: number; longitude: number };
    rating?: number;
    userRatingCount?: number;
    regularOpeningHours?: { openNow: boolean };
    photos?: Array<{ name: string }>;
};

// --- チェーン店ブロックリスト（全国30店舗以上が基準）---
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
    'ブルーボトルコーヒー', 'blue bottle',
    '猿田彦珈琲', 'sarutahiko',
    '丸山珈琲', 'maruyamacoffee',
    '元町珈琲', 'motomachi coffee',
    'カフェラミル', 'cafe la mille',
    '喫茶店ピノキオ', 'cafe pinokio',
    'ビリオン珈琲', 'あずさ珈琲',
    'ワイアードカフェ', 'wired cafe',
    'カフェコムサ', 'cafe comme ca',
    'キャピタルコーヒー', 'capital coffee',

    // ファストフード・コンビニ系（カフェ需要で検索にヒットする場合）
    'マクドナルド', 'mcdonald',
    'モスバーガー', 'mos burger',
    'ケンタッキー', 'kfc',
    'セブン-イレブン', 'セブンイレブン', '7-eleven',
    'ファミリーマート', 'familymart',
    'ローソン', 'lawson',
    'サブウェイ', 'subway',
    'フレッシュネスバーガー', 'freshness burger',
    'ロッテリア', 'lotteria',
    'バーガーキング', 'burger king',
    'ウェンディーズ', "wendy's",
    'サーティワン', 'baskin robbins',
];

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
    'c-united.co.jp',
    'gongcha.co.jp',
    'italian-tomato.co.jp',
    'lindt.co.jp',
    'hollys-corp.jp',
    'ginza-renoir.co.jp',

    // 小〜中規模
    'krispykreme.co.jp',
    'skylark.co.jp',
    'st-germain.jp',
    'becks.co.jp',
    'nanasgreentea.com',
    'ranpu.co.jp',
    'afternoon-tea.net',
    'towafood-net.co.jp',
    'deandeluca.co.jp',
    'toridoll.com',
    'sakaikohiten.com',
    'sirubia.com',
    'takakuramachi-coffee.co.jp',
    'yanaka-coffee.co.jp',
    'bread-espresso.jp',
    'catmocha.jp',
    'bluebottlecoffee.jp',
    'sarutahiko.jp',
    'maruyamacoffee.com',
    'motomachi-coffee.jp',
    'cafe-la-mille.com',
    'cafe-pinokio.com',
    'birioncoffee.com',
    'azusacoffee.com',
    'cafecompany.co.jp',
    'cafe-commeca.co.jp',
    'capital-coffee.co.jp',

    // ファストフード・コンビニ
    'mcdonalds.co.jp',
    'mos.co.jp',
    'kfc.co.jp',
    'sej.co.jp',
    'family.co.jp',
    'lawson.co.jp',
    'subway.co.jp',
    'freshnessburger.co.jp',
    'lotteria.jp',
    'burgerking.co.jp',
    'wendys.co.jp',
    '31ice.co.jp',
];

// --- APIキャッシュ設定 ---
interface CacheEntry {
    data: any;
    timestamp: number;
}
const searchCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24時間キャッシュ

function isChainCafe(name: string, websiteUri?: string): boolean {
    const lowerName = name.toLowerCase();
    const lowerUrl = websiteUri?.toLowerCase() ?? '';
    const nameMatch = chainCafeNames.some(chain => lowerName.includes(chain.toLowerCase()));
    const domainMatch = chainCafeDomains.some(domain => lowerUrl.includes(domain));
    return nameMatch || domainMatch;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const area = searchParams.get('area');
    const category = searchParams.get('category');

    if (!area || !category) {
        return NextResponse.json({ error: 'Area and category are required' }, { status: 400 });
    }

    const cacheKey = `${area}-${category}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return NextResponse.json({ leads: cached.data });
    }

    const apiKey = process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
        console.error('Missing GOOGLE_API_KEY in .env');
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const query = `${area} ${category}`;
    const apiUrl = 'https://places.googleapis.com/v1/places:searchText';

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.primaryType,places.websiteUri,places.location,places.rating,places.userRatingCount,places.regularOpeningHours,places.photos'
            },
            body: JSON.stringify({ textQuery: query })
        });

        const data = await response.json();
        const places: Place[] = data.places || [];

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
                    rating: place.rating,
                    userRatingCount: place.userRatingCount,
                    openNow: place.regularOpeningHours?.openNow,
                    photoName: place.photos?.[0]?.name,
                });
            }
            return acc;
        }, []);

        // 検索結果をキャッシュに保存
        searchCache.set(cacheKey, { data: leads, timestamp: Date.now() });

        return NextResponse.json({ leads });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch places' }, { status: 500 });
    }
}
