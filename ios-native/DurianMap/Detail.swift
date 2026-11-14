import SwiftUI

/// カフェの詳細。一覧と同じシートの中で入れ替わりで出る。
/// スクロールせずに 1 画面で見渡せる量にとどめる。住所・電話・ウェブサイトは読ませず、開く先のボタンにする。
/// 出すのは API から実際に取れた値だけ。取れない項目はボタンごと出さない。
struct DetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    let cafe: Cafe

    var body: some View {
        let savedStatus = model.status(of: cafe)

        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                PhotoPager(urls: API.photoURLs(cafe, size: 800))
                    .frame(height: 190).clipShape(.rect(cornerRadius: 16))
                    .overlay(alignment: .topLeading) {
                        Button { model.selected = nil } label: { Image(systemName: "chevron.left").frame(width: 28, height: 28) }
                            .buttonStyle(.glass).foregroundStyle(.primary).padding(8)
                            .accessibilityLabel("一覧に戻る")
                    }

                VStack(alignment: .leading, spacing: 6) {
                    Text(cafe.name).font(.title3.bold())
                    HStack(spacing: 12) {
                        if let rating = cafe.rating {
                            Label(String(format: "%.1f", rating), systemImage: "star.fill").font(.title3.bold()).labelStyle(RatingLabelStyle())
                            if let count = cafe.userRatingCount { Text("(\(count))").font(.subheadline).foregroundStyle(.secondary) }
                        }
                        StatusLine(cafe: cafe).font(.subheadline)
                    }
                    let facts = [Format.price(cafe), model.distance(to: cafe).map { "\(Format.distance($0)) \(Format.walk($0))" }].compactMap { $0 }
                    if !facts.isEmpty { Text(facts.joined(separator: "  ")).font(.subheadline).foregroundStyle(.secondary) }
                }

                // 主役は経路。保存は幅を固定し、押しても隣が動かないようにする。
                HStack(spacing: 8) {
                    Button { openURL(Format.directionsURL(cafe)) } label: {
                        Label("ここへ行く", systemImage: "arrow.triangle.turn.up.right.diamond").frame(maxWidth: .infinity, minHeight: 32)
                    }
                    .buttonStyle(.glassProminent).foregroundStyle(Brand.onAccent)

                    Button { model.toggleSave(cafe) } label: {
                        Label(savedStatus == nil ? "保存" : "保存済み", systemImage: savedStatus == nil ? "bookmark" : "bookmark.fill")
                            .frame(width: 92, height: 32)
                    }
                    .buttonStyle(.glass).foregroundStyle(savedStatus == nil ? AnyShapeStyle(.primary) : AnyShapeStyle(Brand.hibiscus))
                }
                .font(.subheadline.weight(.medium))

                if let week = Format.week(cafe.weekdayDescriptions) { HoursRow(week: week) }

                // 住所・電話・ウェブサイトは、開く先のボタンにまとめる。
                HStack(alignment: .top, spacing: 0) {
                    shortcut("map", "地図") { openURL(Format.mapsURL(cafe)) }
                    if let phone = cafe.phone, let url = URL(string: "tel:\(phone.filter { $0.isNumber || $0 == "+" })") {
                        shortcut("phone", "電話") { openURL(url) }
                    }
                    if let site = Format.website(cafe) { shortcut("safari", "サイト") { openURL(site) } }
                    ShareLink(item: Format.mapsURL(cafe), subject: Text(cafe.name)) { shortcutLabel("square.and.arrow.up", "共有") }
                        .buttonStyle(.plain).frame(maxWidth: .infinity)
                }

                // 保存後だけ出す。いちばん下に置く（保存を押した瞬間に、上の要素を押し下げないため）。
                if let savedStatus {
                    Picker("保存した状態", selection: Binding(get: { savedStatus }, set: { model.setStatus($0, for: cafe) })) {
                        Text("行きたい").tag("want")
                        Text("訪問済み").tag("visited")
                    }
                    .pickerStyle(.segmented)
                }
            }
            .padding(16)
        }
    }

    private func shortcut(_ icon: String, _ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { shortcutLabel(icon, label) }.buttonStyle(.plain).frame(maxWidth: .infinity)
    }

    private func shortcutLabel(_ icon: String, _ label: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon).font(.body.weight(.medium)).foregroundStyle(Brand.green)
                .frame(width: 48, height: 48)
                .glassEffect(.regular.interactive(), in: .circle)
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .contentShape(.rect)
    }
}

/// 写真。横にスワイプして何枚か見られる。読み込むのは表示されたページだけ（写真は 1 枚ごとに課金されるため）。
struct PhotoPager: View {
    let urls: [URL]
    @State private var page: Int? = 0

    var body: some View {
        if urls.count <= 1 {
            PhotoView(url: urls.first)
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 0) {
                    ForEach(Array(urls.enumerated()), id: \.offset) { index, url in
                        PhotoView(url: url).containerRelativeFrame(.horizontal).id(index)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.paging)
            .scrollPosition(id: $page)
            .overlay(alignment: .bottom) {
                HStack(spacing: 5) {
                    ForEach(urls.indices, id: \.self) { index in
                        Circle().fill(.white.opacity(index == (page ?? 0) ? 1 : 0.45)).frame(width: 6, height: 6)
                    }
                }
                .padding(.horizontal, 8).padding(.vertical, 5)
                .background(.black.opacity(0.35), in: .capsule)
                .padding(8)
                .accessibilityLabel("写真 \((page ?? 0) + 1) / \(urls.count)")
            }
        }
    }
}

/// 営業時間。今日の分だけを 1 行で出し、押すとほかの曜日が開く。
struct HoursRow: View {
    let week: [Format.Day]
    @State private var isExpanded = false

    var body: some View {
        let today = week.first(where: \.isToday) ?? week[0]

        VStack(alignment: .leading, spacing: 10) {
            Button { withAnimation(.snappy) { isExpanded.toggle() } } label: {
                HStack(spacing: 10) {
                    Image(systemName: "clock").foregroundStyle(Brand.green)
                    Text("今日").foregroundStyle(.secondary)
                    Text(today.hours).fontWeight(.medium).monospacedDigit().lineLimit(1)
                    Spacer()
                    Image(systemName: "chevron.down").font(.caption).foregroundStyle(.secondary).rotationEffect(.degrees(isExpanded ? 180 : 0))
                }
                .font(.subheadline)
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("営業時間 今日 \(today.hours)")
            .accessibilityHint(isExpanded ? "ほかの曜日を閉じる" : "ほかの曜日を開く")

            if isExpanded {
                VStack(spacing: 6) {
                    ForEach(week) { day in
                        HStack {
                            Text(day.label).frame(width: 24, alignment: .leading)
                            Text(day.hours).monospacedDigit()
                            Spacer()
                        }
                        .font(.subheadline.weight(day.isToday ? .semibold : .regular))
                        .foregroundStyle(day.isToday ? .primary : .secondary)
                    }
                }
                .padding(.leading, 30)
            }
        }
    }
}
