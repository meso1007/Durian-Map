import CoreLocation
import Foundation
import Observation

// MARK: - モデル（API のレスポンスと一致させる。型の正は frontend/src/lib/api.ts）

struct Cafe: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    var address: String = ""
    var category: String?
    var websiteUri: String?
    var lat: Double?
    var lng: Double?
    var rating: Double?
    var userRatingCount: Int?
    /// サーバーがレスポンス時に JST で計算した営業状態。
    var openNow: Bool?
    var closesAt: String?
    var opensAt: String?
    /// 曜日別の営業時間（月曜始まりの 7 要素）。
    var weekdayDescriptions: [String]?
    var phone: String?
    var priceLevel: String?
    var photoName: String?
    var photoSig: String?
    /// 詳細でスワイプして見る写真（1 枚目を含む、最大 5 枚）。古いレスポンスや保存データには無い。
    var photos: [Photo]?

    struct Photo: Codable, Hashable {
        let name: String
        let sig: String
    }

    var coordinate: CLLocationCoordinate2D? {
        guard let lat, let lng else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
}

/// 保存したカフェ。JSON は Web / Capacitor 版と同じ形（Cafe の各フィールド + status + savedAt を同じ階層に並べる）。
struct SavedCafe: Codable, Identifiable {
    var cafe: Cafe
    var status: String // "want" | "visited"
    var savedAt: String

    var id: String { cafe.id }

    private enum Keys: String, CodingKey { case status, savedAt }

    init(cafe: Cafe, status: String = "want", savedAt: String = ISO8601DateFormatter().string(from: .now)) {
        self.cafe = cafe
        self.status = status
        self.savedAt = savedAt
    }

    init(from decoder: Decoder) throws {
        cafe = try Cafe(from: decoder)
        let container = try decoder.container(keyedBy: Keys.self)
        // status / savedAt の無い旧形式は「行きたい」として読む。
        status = (try? container.decode(String.self, forKey: .status)) == "visited" ? "visited" : "want"
        savedAt = (try? container.decode(String.self, forKey: .savedAt)) ?? ""
    }

    func encode(to encoder: Encoder) throws {
        try cafe.encode(to: encoder)
        var container = encoder.container(keyedBy: Keys.self)
        try container.encode(status, forKey: .status)
        try container.encode(savedAt, forKey: .savedAt)
    }
}

enum SearchQuery: Equatable {
    case area(String)
    case nearby(CLLocationCoordinate2D, radius: Int)

    static func == (lhs: SearchQuery, rhs: SearchQuery) -> Bool {
        switch (lhs, rhs) {
        case let (.area(a), .area(b)): a == b
        case let (.nearby(a, ra), .nearby(b, rb)): a.latitude == b.latitude && a.longitude == b.longitude && ra == rb
        default: false
        }
    }
}

// MARK: - API（Cloudflare Workers）

enum API {
    static let base = URL(string: "https://durian-map-api.dailyreading.workers.dev")!
    static let webBase = "https://durian-map.pages.dev/"

    struct Failure: LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    private struct SearchResponse: Decodable {
        var leads: [Cafe]?
        var error: String?
    }

    static func search(_ query: SearchQuery) async throws -> [Cafe] {
        var components = URLComponents(url: base.appending(path: "api/search"), resolvingAgainstBaseURL: false)!
        var items = [URLQueryItem(name: "category", value: "カフェ")]
        switch query {
        case let .area(name):
            items.append(URLQueryItem(name: "area", value: name))
        case let .nearby(center, radius):
            items += [
                URLQueryItem(name: "lat", value: String(center.latitude)),
                URLQueryItem(name: "lng", value: String(center.longitude)),
                URLQueryItem(name: "radius", value: String(radius)),
            ]
        }
        components.queryItems = items

        let data: Data, response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(from: components.url!)
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw Failure(message: "ネットワークに接続できませんでした。通信環境をご確認ください。")
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 429 { throw Failure(message: "検索の回数が上限に達しました。少し待ってから再度お試しください。") }

        let decoded = try? JSONDecoder().decode(SearchResponse.self, from: data)
        guard status == 200, let decoded else {
            throw Failure(message: decoded?.error ?? "カフェの検索に失敗しました。しばらく経ってから再度お試しください。")
        }
        return decoded.leads ?? []
    }

    /// 写真は Worker のプロキシ経由（署名付き）。サイズは一覧 200 / 詳細 800 の 2 種類だけ使う（課金とキャッシュのため）。
    static func photoURL(_ cafe: Cafe, size: Int) -> URL? {
        guard let name = cafe.photoName, let sig = cafe.photoSig else { return nil }
        return photoURL(name: name, sig: sig, size: size)
    }

    /// 詳細のスワイプ用。複数枚が無ければ 1 枚目だけを返す。
    static func photoURLs(_ cafe: Cafe, size: Int) -> [URL] {
        if let photos = cafe.photos, !photos.isEmpty { return photos.compactMap { photoURL(name: $0.name, sig: $0.sig, size: size) } }
        return [photoURL(cafe, size: size)].compactMap { $0 }
    }

    private static func photoURL(name: String, sig: String, size: Int) -> URL? {
        var components = URLComponents(url: base.appending(path: "api/photo"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "name", value: name), URLQueryItem(name: "sig", value: sig),
            URLQueryItem(name: "maxWidthPx", value: String(size)), URLQueryItem(name: "maxHeightPx", value: String(size)),
        ]
        return components.url
    }
}

// MARK: - 表示用の整形（frontend/src/lib/cafe.ts と同じ規則）

enum Format {
    /// 国名と郵便番号を落とす。
    static func address(_ raw: String) -> String {
        raw.replacing(#/^日本[、,]\s*/#, with: "").replacing(#/〒?\s*\d{3}-\d{4}\s*/#, with: "").trimmingCharacters(in: .whitespaces)
    }

    /// 「14時00分～3時00分」→「14:00–3:00」。
    static func hours(_ raw: String) -> String {
        raw.replacing(#/(\d{1,2})時(\d{2})分/#) { "\($0.1):\($0.2)" }
            .replacing(#/\s*[～〜~]\s*/#, with: "–")
            .replacing(#/\s*,\s*/#, with: "、")
            .replacing(#/24\s*時間営業/#, with: "24時間営業")
            .trimmingCharacters(in: .whitespaces)
    }

    struct Day: Identifiable {
        let id: Int
        let label: String
        let hours: String
        let isToday: Bool
        /// 開いている時間帯（0:00 からの分。日をまたぐと end が 1440 を超える）。
        let ranges: [(start: Double, end: Double)]
    }

    /// 曜日別の営業時間。weekdayDescriptions は月曜始まり、Calendar の weekday は日曜始まり(1)。
    static func week(_ descriptions: [String]?, now: Date = .now) -> [Day]? {
        guard let descriptions, descriptions.count >= 7 else { return nil }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = jst
        let today = (calendar.component(.weekday, from: now) + 5) % 7

        return zip(["月", "火", "水", "木", "金", "土", "日"], descriptions).enumerated().map { index, pair in
            let text = hours(pair.1.replacing(#/^[^:：]+[:：]\s*/#, with: ""))
            return Day(id: index, label: pair.0, hours: text, isToday: index == today, ranges: ranges(text))
        }
    }

    static func ranges(_ hours: String) -> [(start: Double, end: Double)] {
        if hours.contains("24時間営業") { return [(0, 1440)] }
        return hours.matches(of: #/(\d{1,2}):(\d{2})–(\d{1,2}):(\d{2})/#).map { match in
            let start = Double(match.1)! * 60 + Double(match.2)!
            var end = Double(match.3)! * 60 + Double(match.4)!
            if end <= start { end += 1440 }
            return (start, end)
        }
    }

    static let jst = TimeZone(identifier: "Asia/Tokyo")!

    /// いまの時刻（JST、0:00 からの分）。
    static func jstMinutes(_ now: Date = .now) -> Double {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = jst
        let parts = calendar.dateComponents([.hour, .minute], from: now)
        return Double((parts.hour ?? 0) * 60 + (parts.minute ?? 0))
    }

    /// 営業状態の一言。閉店まで 60 分を切っていたら残り時間で伝える。
    static func status(_ cafe: Cafe, now: Date = .now) -> (text: String, detail: String?, isOpen: Bool)? {
        guard let open = cafe.openNow else { return nil }
        if open, let closes = cafe.closesAt, let match = closes.wholeMatch(of: #/(\d{1,2}):(\d{2})/#) {
            var left = Double(match.1)! * 60 + Double(match.2)! - jstMinutes(now)
            if left < 0 { left += 1440 }
            if left <= 60 { return ("あと\(Int(left))分で閉店", nil, false) }
            return ("営業中", "\(closes)まで", true)
        }
        if !open, let opens = cafe.opensAt { return ("営業時間外", "\(opens)から", false) }
        return (open ? "営業中" : "営業時間外", nil, open)
    }

    static let priceFilters: [(id: String, label: String, levels: [String])] = [
        ("cheap", "〜¥1,000", ["PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_FREE"]),
        ("mid", "¥1,000〜2,000", ["PRICE_LEVEL_MODERATE"]),
        ("high", "¥2,000〜", ["PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"]),
    ]

    static func price(_ cafe: Cafe) -> String? {
        guard let level = cafe.priceLevel else { return nil }
        return priceFilters.first { $0.levels.contains(level) }?.label
    }

    static func distance(_ meters: Double) -> String {
        meters < 1000 ? "\(Int((meters / 10).rounded()) * 10)m" : String(format: "%.1fkm", meters / 1000)
    }

    /// 徒歩の目安（80m/分）。
    static func walk(_ meters: Double) -> String { "徒歩約\(max(1, Int((meters / 80).rounded())))分" }

    private static func encode(_ text: String) -> String {
        text.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? text
    }

    static func mapsURL(_ cafe: Cafe) -> URL {
        URL(string: "https://www.google.com/maps/search/?api=1&query=\(encode(cafe.name))&query_place_id=\(encode(cafe.id))")!
    }

    static func directionsURL(_ cafe: Cafe) -> URL {
        URL(string: "https://www.google.com/maps/dir/?api=1&destination=\(encode(cafe.name))&destination_place_id=\(encode(cafe.id))")!
    }

    /// リンクにしてよいウェブサイトだけを返す（値は第三者由来なので http(s) に限る）。
    static func website(_ cafe: Cafe) -> URL? {
        guard let raw = cafe.websiteUri, let url = URL(string: raw), ["http", "https"].contains(url.scheme ?? "") else { return nil }
        return url
    }
}

// MARK: - 友達に送る / AI に相談（frontend/src/lib/sharedList.ts・aiPrompt.ts と同じ形式）

enum Sharing {
    /// 一覧の見出し。全部が同じ市区町村なら「横浜市のカフェ」。
    static func title(_ cafes: [Cafe]) -> String {
        let areas = cafes.map { cafe -> String? in
            Format.address(cafe.address).firstMatch(of: #/^(?:東京都|北海道|(?:京都|大阪)府|.{2,3}県)(.+?[市区町村])/#).map { String($0.1) }
        }
        guard let first = areas.first ?? nil, areas.allSatisfy({ $0 == first }) else { return "行きたいカフェ" }
        return "\(first)のカフェ"
    }

    /// Web 版で開ける一覧のリンク（?list=…）。店の情報を URL に埋め込む。
    static func listURL(title: String, cafes: [Cafe]) -> URL {
        let rows: [[Any]] = cafes.prefix(20).compactMap { cafe in
            guard let lat = cafe.lat, let lng = cafe.lng else { return nil }
            let round = { (value: Double) in (value * 100_000).rounded() / 100_000 }
            return [cafe.id, cafe.name, round(lat), round(lng), cafe.rating ?? NSNull(), Format.address(cafe.address)]
        }
        let data = (try? JSONSerialization.data(withJSONObject: ["t": title, "c": rows])) ?? Data()
        let encoded = data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
        return URL(string: "\(API.webBase)?list=\(encoded)")!
    }

    static func text(title: String, cafes: [Cafe]) -> String {
        let lines = cafes.prefix(20).enumerated().flatMap { index, cafe in
            ["\(index + 1). \(cafe.name)\(cafe.rating.map { String(format: "（★%.1f）", $0) } ?? "")",
             "   \(Format.address(cafe.address))", "   \(Format.mapsURL(cafe).absoluteString)", ""]
        }
        return (["\(title) \(min(cafes.count, 20))軒", ""] + lines + ["地図でまとめて見る", listURL(title: title, cafes: cafes).absoluteString]).joined(separator: "\n")
    }

    private static func describe(_ cafe: Cafe) -> String {
        let status = Format.status(cafe).map { [$0.text, $0.detail].compactMap { $0 }.joined(separator: " ") }
        let facts = [cafe.rating.map { String(format: "評価 %.1f", $0) }, status, Format.price(cafe), Format.address(cafe.address)]
        return "- \(cafe.name): \(facts.compactMap { $0 }.joined(separator: " / "))"
    }

    /// AI に渡すプロンプト。画面の状況（詳細 / 一覧 / 未検索）で変わる。
    static func prompt(title: String?, cafes: [Cafe], selected: Cafe?) -> String {
        let intro = "Durian Map は、大手チェーンを除いて個人経営のカフェだけを地図で探せるアプリです。"
        if let selected {
            return [intro, "いま「\(selected.name)」を見ています。", describe(selected),
                    selected.weekdayDescriptions.map { "営業時間: \($0.joined(separator: " / "))" },
                    selected.websiteUri.map { "ウェブサイト: \($0)" }, "Durian Map: \(API.webBase)", "",
                    "この店について、どんな雰囲気か、どんな使い方（作業・読書・友人と・ひとりで）に向いていそうか、行く前に知っておくとよいことを教えてください。分からないことは推測せず、分からないと言ってください。"]
                .compactMap { $0 }.joined(separator: "\n")
        }
        if !cafes.isEmpty {
            return ([intro, "\(title ?? "カフェ")を探していて、次の \(min(cafes.count, 8)) 軒が候補です。"] + cafes.prefix(8).map(describe) +
                ["Durian Map で開く: \(listURL(title: title ?? "カフェ", cafes: Array(cafes.prefix(8))).absoluteString)", "",
                 "この中から行き先を決めたいです。まず、いまの気分や用途（作業したい、ゆっくり話したい、甘いものが食べたい など）を 1 つだけ質問してください。その答えに合わせて、上の候補から 2〜3 軒を理由つきですすめてください。候補に無い店は挙げないでください。"])
                .joined(separator: "\n")
        }
        return [intro, "Durian Map: \(API.webBase)", "",
                "カフェ探しを手伝ってください。まず、どのあたりで探したいか（駅名や町名）と、どんな過ごし方をしたいかを質問してください。"].joined(separator: "\n")
    }

    static func aiURL(_ base: String, prompt: String) -> URL {
        var components = URLComponents(string: base)!
        components.queryItems = [URLQueryItem(name: "q", value: prompt)]
        return components.url!
    }
}

// MARK: - 現在地

@MainActor
final class LocationService: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<CLLocationCoordinate2D, Error>?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    /// 現在地を 1 回だけ取る。未許可なら OS の許可ダイアログが出る（ユーザーが押したときにだけ呼ぶこと）。
    func current() async throws -> CLLocationCoordinate2D {
        if [.denied, .restricted].contains(manager.authorizationStatus) {
            throw API.Failure(message: "位置情報が許可されていません。設定アプリから位置情報を許可してください。")
        }
        return try await withCheckedThrowingContinuation { continuation in
            self.continuation?.resume(throwing: CancellationError())
            self.continuation = continuation
            if manager.authorizationStatus == .notDetermined { manager.requestWhenInUseAuthorization() } else { manager.requestLocation() }
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            guard continuation != nil else { return }
            switch manager.authorizationStatus {
            case .authorizedWhenInUse, .authorizedAlways: manager.requestLocation()
            case .denied, .restricted: finish(.failure(API.Failure(message: "位置情報が許可されていません。設定アプリから位置情報を許可してください。")))
            default: break
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let coordinate = locations.last?.coordinate else { return }
        Task { @MainActor in finish(.success(coordinate)) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in finish(.failure(API.Failure(message: "現在地を取得できませんでした。少し時間をおいて再度お試しください。"))) }
    }

    private func finish(_ result: Result<CLLocationCoordinate2D, Error>) {
        continuation?.resume(with: result)
        continuation = nil
    }
}

// MARK: - 画面の状態

@MainActor
@Observable
final class AppModel {
    enum Tab: String, CaseIterable { case search = "さがす", saved = "保存" }
    enum Phase: Equatable { case idle, loading, loaded, failed(String) }

    var tab: Tab = .search { didSet { selected = nil } }
    var phase: Phase = .idle
    var query: SearchQuery?
    var results: [Cafe] = []
    var selected: Cafe?
    var location: CLLocationCoordinate2D?
    var isLocating = false
    /// 一時的なお知らせ（保存しました など）。数秒で消す。
    var notice: String?

    var openNowOnly = false
    /// 価格帯は 1 つだけ選べる。
    var priceFilter: String?
    var sortByDistance = false
    var savedFilter: String? // nil = すべて / "want" / "visited"

    private(set) var saved: [SavedCafe] = []
    private(set) var recentAreas: [String] = []

    private let locationService = LocationService()
    private var searchTask: Task<Void, Never>?

    // Capacitor 版（Preferences プラグイン）と同じキー。上書きインストールで保存を引き継ぐ。
    private static let savedKey = "CapacitorStorage.saved_cafes"
    private static let recentKey = "CapacitorStorage.recent_areas"
    static let popularAreas = ["中目黒", "蔵前", "清澄白河", "谷中", "下北沢", "吉祥寺", "鎌倉", "京都"]

    init() {
        let defaults = UserDefaults.standard
        if let raw = defaults.string(forKey: Self.savedKey)?.data(using: .utf8) {
            saved = (try? JSONDecoder().decode([SavedCafe].self, from: raw)) ?? []
        }
        if let raw = defaults.string(forKey: Self.recentKey)?.data(using: .utf8) {
            recentAreas = (try? JSONDecoder().decode([String].self, from: raw)) ?? []
        }
    }

    // 検索

    func search(_ next: SearchQuery) {
        if case let .area(name) = next {
            let trimmed = name.trimmingCharacters(in: .whitespaces)
            guard !trimmed.isEmpty else { return }
            recentAreas = Array(([trimmed] + recentAreas.filter { $0 != trimmed }).prefix(5))
            persist(recentAreas, key: Self.recentKey)
        }

        searchTask?.cancel()
        query = next
        selected = nil
        tab = .search
        phase = .loading
        searchTask = Task {
            do {
                let cafes = try await API.search(next)
                guard !Task.isCancelled else { return }
                results = cafes
                phase = .loaded
            } catch {
                guard !Task.isCancelled, !(error is CancellationError) else { return }
                results = []
                phase = .failed(error.localizedDescription)
            }
        }
    }

    func searchNearby() {
        guard !isLocating else { return }
        isLocating = true
        Task {
            defer { isLocating = false }
            do {
                let here = try await locationService.current()
                location = here
                search(.nearby(here, radius: 1500))
            } catch {
                if !(error is CancellationError) { notice = error.localizedDescription }
            }
        }
    }

    /// ロゴを押した。検索と選択を解いて最初の画面へ戻る。
    func goHome() {
        searchTask?.cancel()
        query = nil
        results = []
        selected = nil
        phase = .idle
        tab = .search
        openNowOnly = false
        priceFilter = nil
    }

    var title: String {
        if tab == .saved { return "保存したカフェ" }
        switch query {
        case let .area(name): return "\(name)のカフェ"
        case .nearby: return "この辺りのカフェ"
        case nil: return "カフェ"
        }
    }

    /// 一覧と地図に出す店（絞り込み・並び替え済み）。
    var visible: [Cafe] {
        var cafes: [Cafe]
        if tab == .saved {
            cafes = saved.filter { savedFilter == nil || $0.status == savedFilter }.map(\.cafe)
        } else {
            let levels = Format.priceFilters.first { $0.id == priceFilter }?.levels
            cafes = results.filter { cafe in
                (!openNowOnly || cafe.openNow == true) && (levels == nil || levels!.contains(cafe.priceLevel ?? ""))
            }
        }
        if sortByDistance, location != nil {
            cafes.sort { (distance(to: $0) ?? .infinity) < (distance(to: $1) ?? .infinity) }
        }
        return cafes
    }

    func distance(to cafe: Cafe) -> Double? {
        guard let location, let target = cafe.coordinate else { return nil }
        return CLLocation(latitude: location.latitude, longitude: location.longitude)
            .distance(from: CLLocation(latitude: target.latitude, longitude: target.longitude))
    }

    // 保存

    func status(of cafe: Cafe) -> String? { saved.first { $0.id == cafe.id }?.status }

    func toggleSave(_ cafe: Cafe) {
        if saved.contains(where: { $0.id == cafe.id }) {
            saved.removeAll { $0.id == cafe.id }
            notice = "保存を解除しました"
        } else {
            saved.append(SavedCafe(cafe: cafe))
            notice = "保存しました"
        }
        persist(saved, key: Self.savedKey)
    }

    func setStatus(_ status: String, for cafe: Cafe) {
        guard let index = saved.firstIndex(where: { $0.id == cafe.id }) else { return }
        saved[index].status = status
        persist(saved, key: Self.savedKey)
    }

    func savedCount(_ status: String?) -> Int { saved.filter { status == nil || $0.status == status }.count }

    private func persist<T: Encodable>(_ value: T, key: String) {
        guard let data = try? JSONEncoder().encode(value), let text = String(data: data, encoding: .utf8) else { return }
        UserDefaults.standard.set(text, forKey: key)
    }
}
