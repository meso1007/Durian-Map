import { describe, expect, it } from 'vitest';

import { normalizeIp, rateLimitKey } from './ratelimit';

describe('normalizeIp', () => {
    it('IPv4 はそのまま', () => {
        expect(normalizeIp('203.0.113.7')).toBe('203.0.113.7');
    });

    /** 丸めないと同じ回線から下位ビットを変えるだけで無制限に叩ける。 */
    it('IPv6 は /64 に丸める', () => {
        expect(normalizeIp('2001:db8:1234:5678:9abc:def0:1234:5678')).toBe(
            '2001:db8:1234:5678::/64',
        );
    });

    it('同じ /64 の別アドレスは同じキーになる', () => {
        expect(normalizeIp('2001:db8:1:2:3:4:5:6')).toBe(normalizeIp('2001:db8:1:2:a:b:c:d'));
    });

    it('別の /64 は別のキーになる', () => {
        expect(normalizeIp('2001:db8:1:2::1')).not.toBe(normalizeIp('2001:db8:1:3::1'));
    });

    it('省略形を展開する', () => {
        expect(normalizeIp('2001:db8::1')).toBe('2001:db8:0:0::/64');
        expect(normalizeIp('::1')).toBe('0:0:0:0::/64');
    });

    it('先頭 0 の有無で別キーにならない', () => {
        expect(normalizeIp('2001:0db8:0000:0001::1')).toBe(normalizeIp('2001:db8:0:1::2'));
    });

    it('IPv4 埋め込み表記はそのまま扱う', () => {
        expect(normalizeIp('::ffff:192.0.2.1')).toBe('::ffff:192.0.2.1');
    });

    it('壊れた値でも落ちない', () => {
        expect(normalizeIp('2001::db8::1')).toBe('2001::db8::1');
    });
});

describe('rateLimitKey', () => {
    it('cf-connecting-ip を優先する', () => {
        const headers = new Headers({ 'cf-connecting-ip': '203.0.113.7', 'cf-ray': 'abc-NRT' });
        expect(rateLimitKey(headers)).toBe('ip:203.0.113.7');
    });

    it('IP が無ければ cf-ray を使う', () => {
        expect(rateLimitKey(new Headers({ 'cf-ray': 'abc-NRT' }))).toBe('ray:abc-NRT');
    });

    /** `unknown` のような固定値にすると、全員が 1 つのバケツを共有してしまう。 */
    it('どちらも無ければ null（共有バケツを作らない）', () => {
        expect(rateLimitKey(new Headers())).toBeNull();
        expect(rateLimitKey(new Headers({ 'cf-connecting-ip': '  ' }))).toBeNull();
    });
});
