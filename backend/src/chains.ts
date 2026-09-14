/**
 * チェーン店の判定ロジック。
 *
 * このファイルが「どの店をチェーン店とみなすか」の唯一の正。
 * フロントエンドや iOS 側で同じ判定を書き直さないこと（docs/platform-strategy.md）。
 *
 * 基準: 全国 30 店舗以上を目安にチェーンとみなす。
 */

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

/**
 * 店名またはウェブサイトのドメインからチェーン店かどうかを判定する。
 *
 * 店名は部分一致（表記ゆれを拾うため）、ドメインは URL への部分一致で見る。
 */
export function isChainCafe(name: string, websiteUri?: string): boolean {
    const lowerName = name.toLowerCase();
    const lowerUrl = websiteUri?.toLowerCase() ?? '';

    const nameMatch = chainCafeNames.some((chain) => lowerName.includes(chain.toLowerCase()));
    const domainMatch = chainCafeDomains.some((domain) => lowerUrl.includes(domain));

    return nameMatch || domainMatch;
}

/** 監視・デバッグ用。ブロックリストの規模を返す。 */
export const chainListSize = {
    names: chainCafeNames.length,
    domains: chainCafeDomains.length,
};
