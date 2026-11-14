import SwiftUI

/// カフェの詳細。一覧と同じシートの中で入れ替わりで出る。
/// 出すのは API から実際に取れた値だけ。取れない項目は行ごと出さない。
struct DetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    let cafe: Cafe

    var body: some View {
        let savedStatus = model.status(of: cafe)

        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                PhotoView(url: API.photoURL(cafe, size: 800))
                    .frame(height: 150).clipShape(.rect(cornerRadius: 16))
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

                // 主役は経路。保存と共有は幅を固定し、押しても隣が動かないようにする。
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

                    ShareLink(item: Format.mapsURL(cafe), subject: Text(cafe.name)) {
                        Image(systemName: "square.and.arrow.up").frame(width: 28, height: 32)
                    }
                    .buttonStyle(.glass).foregroundStyle(.primary).accessibilityLabel("共有")
                }
                .font(.subheadline.weight(.medium))

                if let week = Format.week(cafe.weekdayDescriptions) { HoursClock(week: week) }

                VStack(spacing: 0) {
                    infoRow("mappin.and.ellipse", "住所", Format.address(cafe.address), Format.mapsURL(cafe))
                    if let phone = cafe.phone, let url = URL(string: "tel:\(phone.filter { $0.isNumber || $0 == "+" })") {
                        Divider(); infoRow("phone", "電話", phone, url)
                    }
                    if let site = Format.website(cafe) {
                        Divider(); infoRow("link", "ウェブサイト", site.host()?.replacing(#/^www\./#, with: "") ?? site.absoluteString, site)
                    }
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

    private func infoRow(_ icon: String, _ label: String, _ value: String, _ url: URL) -> some View {
        Link(destination: url) {
            HStack(spacing: 12) {
                Image(systemName: icon).frame(width: 28).foregroundStyle(Brand.green)
                VStack(alignment: .leading, spacing: 2) {
                    Text(label).font(.caption).foregroundStyle(.secondary)
                    Text(value).font(.subheadline).foregroundStyle(.primary).multilineTextAlignment(.leading)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
            }
            .padding(.vertical, 10)
            .contentShape(.rect)
        }
        // リンクの色（アクセント）を本文に移さない。色が付くのはアイコンだけ。
        .buttonStyle(.plain)
    }
}

/// 営業時間を、24 時間で 1 周する時計の文字盤で出す。
/// 輪の塗ってある所が開いている時間、針が「いま」（今日の文字盤にだけ出す）。下の曜日で切り替える。
struct HoursClock: View {
    let week: [Format.Day]
    @State private var selectedIndex: Int

    init(week: [Format.Day]) {
        self.week = week
        _selectedIndex = State(initialValue: week.first(where: \.isToday)?.id ?? 0)
    }

    var body: some View {
        let day = week[selectedIndex]

        VStack(alignment: .leading, spacing: 12) {
            Text("営業時間").font(.caption).foregroundStyle(.secondary)

            HStack(spacing: 20) {
                dial(day).frame(width: 132, height: 132)

                VStack(alignment: .leading, spacing: 4) {
                    Text("\(day.label)曜日\(day.isToday ? "（今日）" : "")").font(.subheadline).foregroundStyle(.secondary)
                    ForEach(day.hours.split(separator: "、"), id: \.self) { Text($0).font(.body.weight(.medium)).monospacedDigit() }
                }
            }

            Picker("曜日", selection: $selectedIndex) {
                ForEach(week) { Text($0.label).tag($0.id) }
            }
            .pickerStyle(.segmented)
        }
    }

    private func dial(_ day: Format.Day) -> some View {
        // 0 時が真上、時計回り。trim は 3 時の位置から始まるので -90 度まわす。
        ZStack {
            Circle().stroke(.quaternary, lineWidth: 12)

            ForEach(Array(day.ranges.enumerated()), id: \.offset) { _, range in
                let start = range.start.truncatingRemainder(dividingBy: 1440) / 1440
                let length = min(range.end - range.start, 1439.5) / 1440
                Circle().trim(from: 0, to: length)
                    .stroke(day.isToday ? Brand.green : Brand.green.opacity(0.6), style: StrokeStyle(lineWidth: 12, lineCap: .round))
                    .rotationEffect(.degrees(start * 360 - 90))
            }

            ForEach([0, 6, 12, 18], id: \.self) { hour in
                // 文字盤の位置へまわしてから、数字そのものは逆にまわして正立させる。
                Text("\(hour)").font(.caption2).foregroundStyle(.secondary).monospacedDigit()
                    .rotationEffect(.degrees(-Double(hour) * 15))
                    .offset(y: -40).rotationEffect(.degrees(Double(hour) * 15))
            }

            if day.isToday {
                Capsule().fill(Brand.mangoDeep).frame(width: 3, height: 46).offset(y: -23)
                    .rotationEffect(.degrees(Format.jstMinutes() / 1440 * 360))
                Circle().fill(Brand.mangoDeep).frame(width: 9, height: 9)
            }
        }
        .padding(6)
        .accessibilityElement()
        .accessibilityLabel("\(day.label)曜日 \(day.hours)")
    }
}
