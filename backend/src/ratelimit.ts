/**
 * レート制限。
 *
 * 実体は Workers の Rate Limiting binding（`wrangler.jsonc` の `ratelimits`）。
 * 以前は KV カウンタで数えていたが、全リクエストが KV write を 1 回使うため
 * 無料枠 1,000 writes/日を 50 検索ほどで使い切り、枯渇すると
 * **レート制限と検索キャッシュが同時に死ぬ**という壊れ方をしていた。
 * binding は KV を使わず追加費用もない。
 *
 * ここに残すのは「誰を 1 クライアントとみなすか」の判断だけ。
 */

/**
 * レート制限のキーを決める。
 *
 * - `cf-connecting-ip` が正。IPv6 は端末ごとに下位ビットが変わるので /64 に丸める
 *   （丸めないと同じ回線から実質無制限に叩ける）
 * - ヘッダが無いときは `cf-ray` を使う。`unknown` のような固定値にすると
 *   ヘッダを外した全員が 1 つのバケツを共有し、互いを締め出せてしまう
 * - どちらも無い（ローカル実行など）ときは null。呼び出し側は素通しする
 */
export function rateLimitKey(headers: Headers): string | null {
    const ip = headers.get('cf-connecting-ip')?.trim();
    if (ip) return `ip:${normalizeIp(ip)}`;

    const ray = headers.get('cf-ray')?.trim();
    if (ray) return `ray:${ray}`;

    return null;
}

/** IPv6 は /64（先頭 4 グループ）に丸める。IPv4 とマップ済みアドレスはそのまま。 */
export function normalizeIp(ip: string): string {
    const lower = ip.toLowerCase();

    // IPv4、または ::ffff:192.0.2.1 のような IPv4 埋め込み表記。
    if (!lower.includes(':') || lower.includes('.')) return lower;

    const groups = expandIpv6(lower);
    if (!groups) return lower;

    return `${groups.slice(0, 4).join(':')}::/64`;
}

/** `2001:db8::1` のような省略形を 8 グループに展開する。壊れていたら null。 */
function expandIpv6(ip: string): string[] | null {
    // ゾーン ID（%eth0）は落とす。
    const address = ip.split('%')[0];
    const halves = address.split('::');
    if (halves.length > 2) return null;

    const head = halves[0] ? halves[0].split(':') : [];

    if (halves.length === 1) {
        return head.length === 8 ? head.map(trimGroup) : null;
    }

    const tail = halves[1] ? halves[1].split(':') : [];
    const fill = 8 - head.length - tail.length;
    if (fill < 0) return null;

    return [...head, ...Array(fill).fill('0'), ...tail].map(trimGroup);
}

/** `0db8` と `db8` を同じ表記に寄せる。 */
function trimGroup(group: string): string {
    return group.replace(/^0+(?=.)/, '');
}
