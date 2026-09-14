"""Durian Map 月額コスト試算（2026-09 時点の Google Maps Platform 料金）。
前提はすべて明示。数字は「桁感」を掴むための概算。
"""
PRICE = {  # $/1000, 無料枠/月
    "search_enterprise": (35.0, 1000),   # Text/Nearby Search Enterprise
    "photos": (7.0, 1000),               # Place Details Photos (Enterprise)
    "dynamic_maps": (7.0, 10000),        # Maps JavaScript API map load
}
def over(n, key):
    price, free = PRICE[key]
    return max(0, n - free) * price / 1000

def scenario(name, sessions_per_day, searches_per_session=2, photos_per_search=15,
             search_miss_now=0.6, search_miss_after=0.35,
             photo_miss_now=0.5, photo_miss_after=0.15):
    s = sessions_per_day * 30
    searches = s * searches_per_session
    photos = searches * photos_per_search
    now = over(searches * search_miss_now, "search_enterprise") + over(photos * photo_miss_now, "photos") + over(s, "dynamic_maps")
    after = over(searches * search_miss_after, "search_enterprise") + over(photos * photo_miss_after, "photos") + over(s, "dynamic_maps")
    return name, s, searches, photos, round(now), round(after)

rows = [
    scenario("A. 趣味利用（自分+友人）", 10, search_miss_now=0.5, search_miss_after=0.3, photo_miss_now=0.5, photo_miss_after=0.15),
    scenario("B. 100 DAU", 100),
    scenario("C. 1,000 DAU", 1000),
]
print("| シナリオ | セッション/月 | 検索/月 | 写真ロード/月 | 現状 $/月 | 対策後 $/月 |")
print("|---|---|---|---|---|---|")
for r in rows:
    print(f"| {r[0]} | {r[1]:,} | {r[2]:,} | {r[3]:,} | {r[4]:,} | {r[5]:,} |")
# KV 書き込み上限（無料 1,000/日）に何検索で当たるか
kv_writes_per_search = 1 + 15 + 1  # レート制限: 検索1 + 写真15、キャッシュ書き込み1
print("\nKV writes/search =", kv_writes_per_search, "→ 1,000 writes/day で", 1000 // kv_writes_per_search, "検索/日")
