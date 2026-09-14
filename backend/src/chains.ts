/**
 * チェーン店の判定ロジック。
 *
 * このファイルが「どの店をチェーン店とみなすか」の唯一の正。
 * フロントエンドや iOS 側で同じ判定を書き直さないこと（docs/platform-strategy.md）。
 *
 * 基準: 全国 30 店舗以上を目安にチェーンとみなす。
 *
 * 判定は両方向に間違えうる。取りこぼし（チェーンが残る）より
 * **誤除外（個人店が消える）のほうが重い**ので、部分一致は慎重に使う。
 * 変更したら src/chains.test.ts に固定例を足すこと。
 */

const chainCafeNames = [
    // 大手コーヒーチェーン（500店舗以上）
    'スターバックス', 'starbucks',
    'ドトール', 'doutor',
    'コメダ', 'komeda',
    'ミスタードーナツ', 'mister donut', 'misdo',
    'タリーズ', "tully's", 'tullys',
    '上島珈琲', 'ueshima',

    // 中堅チェーン（100〜499店舗）
    'プロント', 'pronto',
    'サンマルクカフェ', 'saint marc', 'saint-marc', 'sanmarc',
    '星乃珈琲', 'hoshino coffee', 'hoshinocoffee',
    'ヴィ・ド・フランス', 'vie de france',
    '珈琲館', 'kohikan',
    'ゴンチャ', 'gong cha',
    'カフェ・ド・クリエ', 'cafe de crie',
    'ベローチェ', 'veloce',
    'エクセルシオール', 'excelsior',
    'イタリアントマト', 'italian tomato',
    // 「リンツ」だけだと「喫茶ブリンツ」のような個人店を巻き込むので店名の形で持つ。
    'リンツ ショコラ', 'リンツショコラ', 'lindt',
    'ホリーズカフェ', "holly's",
    'ルノアール', 'renoir',

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
    'コナズ珈琲', 'konas coffee',
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

/**
 * チェーンの**店舗ブランド**のドメイン。ホスト名の完全一致かサブドメイン一致で見る。
 *
 * 持株会社・親会社のドメイン（`ucc.co.jp` / `skylark.co.jp` / `toridoll.com` など）は
 * 個店のサイトには現れず誤検知の材料にしかならないので入れない。
 * ブランドのサイトが親会社ドメインの配下（パス）にしかない場合は店名側で拾う。
 */
const chainCafeDomains = [
    // 大手
    'starbucks.co.jp',
    'tullys.co.jp',
    'doutor.co.jp',
    'komeda.co.jp',
    'misterdonut.jp',
    'ueshima-coffee-ten.jp',

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
    'st-germain.jp',
    'becks.co.jp',
    'nanasgreentea.com',
    'ranpu.co.jp',
    'afternoon-tea.net',
    'towafood-net.co.jp',
    'deandeluca.co.jp',
    'konascoffee.com',
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
 * 比較用の正規化。
 *
 * NFKC で全角英数（ＳＴＡＲＢＵＣＫＳ）と半角カタカナ（ｺﾒﾀﾞ）の揺れを吸収してから
 * 小文字化する。これを通さないと「DOUTOR」「ＳＴＡＲＢＵＣＫＳ」が素通りする。
 */
export function normalizeName(value: string): string {
    return value.normalize('NFKC').toLowerCase();
}

/**
 * 語境界を要求するかどうか。
 *
 * `kfc` `misdo` のような短い ASCII 語は、部分一致だと `KFCafe` のような
 * 無関係な店名に当たってしまうので前後が英数字でないことを要求する。
 * 日本語の語や長い語は部分一致のままにする（表記ゆれを拾うため）。
 */
function requiresWordBoundary(token: string): boolean {
    // eslint-disable-next-line no-control-regex
    return /^[\x20-\x7e]+$/.test(token) && token.length <= 6;
}

const WORD_CHARACTER = /[a-z0-9]/;

function includesAtWordBoundary(haystack: string, token: string): boolean {
    let from = 0;
    for (;;) {
        const at = haystack.indexOf(token, from);
        if (at === -1) return false;

        const before = at === 0 ? '' : haystack[at - 1];
        const after = haystack[at + token.length] ?? '';
        if (!WORD_CHARACTER.test(before) && !WORD_CHARACTER.test(after)) return true;

        from = at + 1;
    }
}

/** 正規化済みのトークン。モジュール読み込み時に 1 度だけ作る。 */
const normalizedNameTokens = chainCafeNames.map((chain) => {
    const token = normalizeName(chain);
    return { token, boundary: requiresWordBoundary(token) };
});

/**
 * ウェブサイト URL からホスト名を取り出す。
 *
 * URL 全体への部分一致だと `cosmos.co.jp` が `mos.co.jp` に、
 * `myfamily.co.jp` が `family.co.jp` に当たって**個人店を消してしまう**。
 */
export function extractHost(websiteUri: string): string | null {
    try {
        const host = new URL(websiteUri).hostname.toLowerCase();
        return host.startsWith('www.') ? host.slice(4) : host;
    } catch {
        return null;
    }
}

/**
 * 店名またはウェブサイトのドメインからチェーン店かどうかを判定する。
 *
 * 店名は NFKC + 小文字化した上での部分一致（短い ASCII 語だけ語境界を要求）、
 * ドメインはホスト名の完全一致かサブドメイン一致で見る。
 */
export function isChainCafe(name: string, websiteUri?: string): boolean {
    const normalizedName = normalizeName(name);

    const nameMatch = normalizedNameTokens.some(({ token, boundary }) =>
        boundary
            ? includesAtWordBoundary(normalizedName, token)
            : normalizedName.includes(token),
    );
    if (nameMatch) return true;

    const host = websiteUri ? extractHost(websiteUri) : null;
    if (!host) return false;

    return chainCafeDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/** 監視・デバッグ用。ブロックリストの規模を返す。 */
export const chainListSize = {
    names: chainCafeNames.length,
    domains: chainCafeDomains.length,
};
