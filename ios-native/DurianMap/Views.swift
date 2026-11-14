import MapKit
import SwiftUI

// MARK: - 画面の骨格: 全面の地図 + 上に浮く検索バー + 下のシート
//
// シートは OS 標準のもの。iOS 26 では標準のシート・ボタン・メニューが Liquid Glass で描かれるので、
// ガラスを自前で再現しない。自前で付けるのは、地図の上に浮く検索バーと小さなボタンだけ（.glassEffect）。

struct ContentView: View {
    @Environment(AppModel.self) private var model
    @State private var camera: MapCameraPosition = .region(Self.tokyo)
    @State private var detent: PresentationDetent = .medium
    @State private var searchText = ""
    @FocusState private var searchFocused: Bool

    private static let tokyo = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 35.6762, longitude: 139.6503),
        span: MKCoordinateSpan(latitudeDelta: 0.12, longitudeDelta: 0.12)
    )
    private static let peek = PresentationDetent.height(96)

    var body: some View {
        @Bindable var model = model
        let cafes = model.visible
        let featured = featuredIDs(cafes)

        Map(position: $camera) {
            UserAnnotation()
            ForEach(cafes) { cafe in
                if let coordinate = cafe.coordinate {
                    Annotation(cafe.name, coordinate: coordinate, anchor: .bottom) {
                        PinView(cafe: cafe, showsRating: featured.contains(cafe.id) || model.selected?.id == cafe.id,
                                isSelected: model.selected?.id == cafe.id, isSaved: model.status(of: cafe) != nil)
                            .onTapGesture {
                                model.selected = cafe
                                detent = .medium
                            }
                    }
                    .annotationTitles(.hidden)
                }
            }
        }
        .mapControls { MapCompass() }
        .safeAreaInset(edge: .top) { searchBar }
        // 「AI に相談」はシートのすぐ上に置く（シートの高さは段で変わる。半分の段では画面の半分）。
        .overlay {
            GeometryReader { geometry in
                askAI
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                    .padding(.leading, 12)
                    .padding(.bottom, detent == Self.peek ? 108 : geometry.size.height * 0.5 + 12)
            }
            .ignoresSafeArea()
        }
        .overlay(alignment: .top) { noticeView }
        .sheet(isPresented: .constant(true)) {
            SheetContent(detent: $detent)
                .presentationDetents([Self.peek, .medium, .large], selection: $detent)
                .presentationBackgroundInteraction(.enabled(upThrough: .medium))
                .presentationDragIndicator(.visible)
                .interactiveDismissDisabled()
        }
        .onChange(of: cafes.map(\.id).sorted()) { fit(cafes) }
        .onChange(of: model.selected?.id) { if let cafe = model.selected { focus(cafe) } }
        .onChange(of: model.query) { if case let .area(name) = model.query { searchText = name } else { searchText = "" } }
    }

    // 検索バー。ロゴは「最初の画面に戻る」ボタン。
    private var searchBar: some View {
        HStack(spacing: 8) {
            Button { model.goHome() } label: { Image("BrandMark").resizable().scaledToFit().frame(width: 30, height: 30) }
                .accessibilityLabel("最初の画面に戻る")

            TextField("エリア・駅名でさがす", text: $searchText, prompt: Text(""))
                .background(alignment: .leading) {
                    // ガラスの上では prompt の色が薄く調色されて読めないので、普通の Text として重ねる。
                    if searchText.isEmpty { Text("エリア・駅名でさがす").foregroundStyle(.primary.opacity(0.75)).allowsHitTesting(false).accessibilityHidden(true) }
                }
                .foregroundStyle(.primary)
                .focused($searchFocused)
                .submitLabel(.search)
                .onSubmit { model.search(.area(searchText)); detent = .medium }

            if !searchText.isEmpty {
                Button { searchText = ""; searchFocused = true } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }
                    .accessibilityLabel("入力を消す")
            }

            if model.phase != .idle || model.tab == .saved {
                Button { model.searchNearby(); detent = .medium } label: {
                    if model.isLocating { ProgressView() } else { Image(systemName: "location.fill") }
                }
                .accessibilityLabel("近くからさがす")
            }
        }
        .padding(.horizontal, 14)
        .frame(height: 52)
        .glassEffect(.regular.interactive(), in: .capsule)
        .padding(.horizontal, 12)
        .padding(.top, 4)
    }

    // AI に相談。いまの画面の内容を入れたプロンプトで、外部の AI チャットを開く。
    private var askAI: some View {
        let prompt = Sharing.prompt(title: model.phase == .idle && model.tab == .search ? nil : model.title, cafes: model.visible, selected: model.selected)
        return Menu {
            Link("ChatGPT で開く", destination: Sharing.aiURL("https://chatgpt.com/", prompt: prompt))
            Link("Claude で開く", destination: Sharing.aiURL("https://claude.ai/new", prompt: prompt))
            Button("プロンプトをコピー") {
                UIPasteboard.general.string = prompt
                model.notice = "プロンプトをコピーしました"
            }
        } label: {
            Label("AI に相談", systemImage: "bubble.left.and.text.bubble.right")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.primary)
                .padding(.horizontal, 14)
                .frame(height: 44)
        }
        // メニューのラベルはアクセント色になるので、本文の色に戻す（ガラスの上で読めるように）。
        .tint(.primary)
        .glassEffect(.regular.interactive(), in: .capsule)
        .opacity(detent == .large ? 0 : 1)
    }

    @ViewBuilder private var noticeView: some View {
        if let notice = model.notice {
            Text(notice)
                .font(.subheadline.weight(.medium))
                .padding(.horizontal, 16).padding(.vertical, 10)
                .glassEffect(.regular, in: .capsule)
                .padding(.top, 68)
                .transition(.opacity)
                .task(id: notice) {
                    try? await Task.sleep(for: .seconds(3))
                    if model.notice == notice { model.notice = nil }
                }
        }
    }

    /// 評価の札を最初から出す店（評価の高い順に 5 軒）。ほかは小さな丸にして地図を静かに保つ。
    private func featuredIDs(_ cafes: [Cafe]) -> Set<String> {
        Set(cafes.filter { $0.rating != nil }.sorted { ($0.rating!, $0.userRatingCount ?? 0) > ($1.rating!, $1.userRatingCount ?? 0) }.prefix(5).map(\.id))
    }

    /// 結果全体が、シートに隠れていない上半分に収まるようにする。
    private func fit(_ cafes: [Cafe]) {
        let points = cafes.compactMap(\.coordinate)
        guard let first = points.first else { return }
        let lats = points.map(\.latitude), lngs = points.map(\.longitude)
        let latSpan = max((lats.max()! - lats.min()!) * 1.5, 0.008)
        let lngSpan = max((lngs.max()! - lngs.min()!) * 1.5, 0.008)
        let center = points.count == 1 ? first : CLLocationCoordinate2D(latitude: (lats.max()! + lats.min()!) / 2, longitude: (lngs.max()! + lngs.min()!) / 2)
        // 縦は 2.2 倍に取り、中心を下へずらす（画面の下半分はシートの下になるため）。
        withAnimation { camera = .region(MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: center.latitude - latSpan * 0.55, longitude: center.longitude),
            span: MKCoordinateSpan(latitudeDelta: latSpan * 2.2, longitudeDelta: lngSpan))) }
    }

    private func focus(_ cafe: Cafe) {
        guard let coordinate = cafe.coordinate else { return }
        let span = 0.012
        withAnimation { camera = .region(MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: coordinate.latitude - span * 0.28, longitude: coordinate.longitude),
            span: MKCoordinateSpan(latitudeDelta: span, longitudeDelta: span))) }
    }
}

/// 地図のピン。評価のある上位の店と選択中の店は札（星 + 評価）、ほかは小さな二重丸。枠の色は営業状態。
struct PinView: View {
    let cafe: Cafe
    let showsRating: Bool
    let isSelected: Bool
    let isSaved: Bool

    var body: some View {
        let stroke: Color = cafe.openNow == true ? Brand.pinOpen : Brand.pinMuted
        Group {
            if showsRating, let rating = cafe.rating {
                Label(String(format: "%.1f", rating), systemImage: "star.fill")
                    .font(.caption.weight(.bold))
                    .labelStyle(.titleAndIcon)
                    .foregroundStyle(isSelected ? Brand.pin : Brand.pinText)
                    .padding(.horizontal, 8).frame(height: 28)
                    .background(isSelected ? Brand.pinOpen : Brand.pin, in: .capsule)
                    .overlay(Capsule().strokeBorder(isSelected ? Brand.pin : stroke, lineWidth: 2))
                    .shadow(color: .black.opacity(0.25), radius: 3, y: 1)
            } else {
                Circle().fill(Brand.pin).frame(width: 18, height: 18)
                    .overlay(Circle().strokeBorder(stroke, lineWidth: 2.5))
                    .overlay(Circle().fill(stroke).frame(width: 5, height: 5))
            }
        }
        .overlay(alignment: .topTrailing) {
            if isSaved { Circle().fill(Brand.pinSaved).frame(width: 9, height: 9).offset(x: 3, y: -3) }
        }
        .scaleEffect(isSelected ? 1.2 : 1, anchor: .bottom)
        // 押せる領域は 44pt を確保する。
        .frame(minWidth: 44, minHeight: 44)
        .contentShape(.rect)
        .accessibilityLabel(cafe.name)
    }
}

// MARK: - シートの中身: 初回表示 / 一覧 / 詳細のどれか 1 つ

struct SheetContent: View {
    @Environment(AppModel.self) private var model
    @Binding var detent: PresentationDetent

    var body: some View {
        @Bindable var model = model

        if let cafe = model.selected {
            DetailView(cafe: cafe)
        } else {
            VStack(spacing: 0) {
                Picker("表示の切り替え", selection: $model.tab) {
                    ForEach(AppModel.Tab.allCases, id: \.self) { tab in
                        Text(tab == .saved && !model.saved.isEmpty ? "\(tab.rawValue) \(model.saved.count)" : tab.rawValue).tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16).padding(.top, 20).padding(.bottom, 8)

                if model.tab == .search, model.phase == .idle { welcome } else { list }
            }
        }
    }

    // 初回表示。押せるものだけを並べる（キャッチコピーは置かない）。
    private var welcome: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Button { model.searchNearby() } label: {
                    Label(model.isLocating ? "現在地を取得中…" : "近くからさがす", systemImage: "location.fill")
                        .font(.body.weight(.medium)).frame(maxWidth: .infinity, minHeight: 36)
                }
                .buttonStyle(.glassProminent).tint(Brand.mango).foregroundStyle(.black)
                .disabled(model.isLocating)

                if !model.recentAreas.isEmpty { areaGroup("最近の検索", model.recentAreas) }
                areaGroup("エリアからさがす", AppModel.popularAreas.filter { !model.recentAreas.contains($0) })
            }
            .padding(16)
        }
    }

    private func areaGroup(_ title: String, _ areas: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            FlowLayout(spacing: 8) {
                ForEach(areas, id: \.self) { area in
                    Button(area) { model.search(.area(area)) }.buttonStyle(.glass).foregroundStyle(.primary)
                }
            }
        }
    }

    private var list: some View {
        @Bindable var model = model
        let cafes = model.visible

        return ScrollView {
            LazyVStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline) {
                    Text(model.title).font(.title3.bold()).lineLimit(1)
                    if model.tab == .search, model.phase == .loaded { Text("\(cafes.count)件").font(.subheadline).foregroundStyle(.secondary) }
                    Spacer()
                    // 保存の一覧（いま見えている分）を、文章と一覧のリンクにして友達に送る。
                    if model.tab == .saved, !cafes.isEmpty {
                        ShareLink(item: Sharing.text(title: Sharing.title(cafes), cafes: cafes)) { Text("友達に送る").font(.subheadline.weight(.medium)) }
                            .buttonStyle(.glassProminent).foregroundStyle(Brand.onAccent)
                    }
                }
                .padding(.horizontal, 16).padding(.top, 8)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        if model.tab == .saved {
                            chip("すべて \(model.savedCount(nil))", active: model.savedFilter == nil) { model.savedFilter = nil }
                            chip("行きたい \(model.savedCount("want"))", active: model.savedFilter == "want") { model.savedFilter = "want" }
                            chip("訪問済み \(model.savedCount("visited"))", active: model.savedFilter == "visited") { model.savedFilter = "visited" }
                        } else if model.phase == .loaded, !model.results.isEmpty {
                            chip("営業中", active: model.openNowOnly) { model.openNowOnly.toggle() }
                            ForEach(Format.priceFilters, id: \.id) { filter in
                                // 価格帯は 1 つだけ。選んでいるものをもう一度押すと外れる。
                                chip(filter.label, active: model.priceFilter == filter.id) { model.priceFilter = model.priceFilter == filter.id ? nil : filter.id }
                            }
                        }
                        if model.location != nil, cafes.count > 1 { chip("近い順", active: model.sortByDistance) { model.sortByDistance.toggle() } }
                    }
                    .padding(.horizontal, 16).padding(.vertical, 6)
                }

                if model.phase == .loading, model.tab == .search {
                    ProgressView("検索中").frame(maxWidth: .infinity).padding(.top, 40)
                } else if cafes.isEmpty {
                    emptyState
                } else {
                    ForEach(cafes) { cafe in
                        Button { model.selected = cafe; detent = .large } label: { CafeRow(cafe: cafe) }.buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func chip(_ label: String, active: Bool, action: @escaping () -> Void) -> some View {
        Group {
            if active {
                Button(label, action: action).buttonStyle(.glassProminent).foregroundStyle(Brand.onAccent)
            } else {
                Button(label, action: action).buttonStyle(.glass).foregroundStyle(.primary)
            }
        }
        .font(.subheadline)
        .accessibilityAddTraits(active ? .isSelected : [])
    }

    @ViewBuilder private var emptyState: some View {
        let (title, message): (String, String) = {
            if model.tab == .saved { return ("まだ保存したカフェはありません", "気になるカフェを開いて「保存」すると、ここに並びます。") }
            if case let .failed(reason) = model.phase { return ("検索できませんでした", reason) }
            if model.openNowOnly || model.priceFilter != nil { return ("条件に合うカフェがありません", "絞り込みを外すと、ほかのカフェが表示されます。") }
            return ("カフェが見つかりませんでした", "駅名や町名を変えて探してみてください。")
        }()
        ContentUnavailableView(title, image: "BrandMark", description: Text(message)).padding(.top, 24)
        if case .failed = model.phase, let query = model.query {
            Button("もう一度さがす") { model.search(query) }.buttonStyle(.glass).frame(maxWidth: .infinity)
        }
    }
}

/// 一覧の 1 行。行全体がタップ領域（行の中に別のボタンは置かない）。
struct CafeRow: View {
    @Environment(AppModel.self) private var model
    let cafe: Cafe

    var body: some View {
        HStack(spacing: 12) {
            PhotoView(url: API.photoURL(cafe, size: 200)).frame(width: 84, height: 84).clipShape(.rect(cornerRadius: 12))

            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .top) {
                    Text(cafe.name).font(.body.weight(.medium)).lineLimit(2)
                    Spacer(minLength: 4)
                    if let status = model.status(of: cafe) {
                        // 薄い色面はガラス越しの地図と混ざって読めないので、印と文字だけにする。
                        Label(status == "visited" ? "訪問済み" : "行きたい", systemImage: status == "visited" ? "checkmark.circle.fill" : "bookmark.fill")
                            .font(.caption.weight(.medium)).labelStyle(.titleAndIcon)
                            .foregroundStyle(status == "visited" ? Brand.green : Brand.hibiscus)
                    }
                }
                HStack(spacing: 6) {
                    if let rating = cafe.rating {
                        Label(String(format: "%.1f", rating), systemImage: "star.fill").font(.subheadline.weight(.bold)).labelStyle(RatingLabelStyle())
                        if let count = cafe.userRatingCount { Text("(\(count))").font(.caption).foregroundStyle(.secondary) }
                    }
                    if let meters = model.distance(to: cafe) { Text("\(Format.distance(meters)) \(Format.walk(meters))").font(.caption).foregroundStyle(.secondary) }
                }
                StatusLine(cafe: cafe).font(.footnote)
                TodayBar(cafe: cafe)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 8)
        .contentShape(.rect)
    }
}

struct RatingLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 3) { configuration.icon.foregroundStyle(Brand.star).imageScale(.small); configuration.title }
    }
}

/// 営業状態（点 + 文字）。「いつまで開いているか」まで出す。
struct StatusLine: View {
    let cafe: Cafe

    var body: some View {
        if let status = Format.status(cafe) {
            HStack(spacing: 5) {
                Circle().fill(status.isOpen ? Brand.green : Brand.hibiscus).frame(width: 6, height: 6)
                Text(status.text).fontWeight(.medium).foregroundStyle(status.isOpen ? Brand.green : Brand.hibiscus)
                if let detail = status.detail { Text(detail).foregroundStyle(.secondary) }
            }
        }
    }
}

/// 今日の営業時間の帯（6 時 → 24 時）。塗ってある所が開いている時間、線が「いま」。
struct TodayBar: View {
    let cafe: Cafe

    var body: some View {
        if let today = Format.week(cafe.weekdayDescriptions)?.first(where: \.isToday) {
            GeometryReader { geometry in
                let x = { (minutes: Double) in (min(max(minutes, 360), 1440) - 360) / 1080 * geometry.size.width }
                ZStack(alignment: .leading) {
                    Capsule().fill(.quaternary)
                    ForEach(Array(today.ranges.enumerated()), id: \.offset) { _, range in
                        Capsule().fill(Brand.green.opacity(0.85)).frame(width: max(x(range.end) - x(range.start), 2)).offset(x: x(range.start))
                    }
                    let now = Format.jstMinutes()
                    if now >= 360 { Rectangle().fill(Brand.mangoDeep).frame(width: 2).offset(x: x(now) - 1) }
                }
            }
            .frame(height: 5).clipShape(.capsule).padding(.top, 2)
            .accessibilityHidden(true)
        }
    }
}

struct PhotoView: View {
    let url: URL?

    var body: some View {
        Rectangle().fill(.quaternary)
            .overlay {
                AsyncImage(url: url) { image in image.resizable().scaledToFill() } placeholder: {
                    Image("BrandMark").resizable().scaledToFit().frame(width: 28).opacity(0.35)
                }
            }
            .clipped()
    }
}

/// 折り返して並べる（エリアのボタン用）。
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(subviews, width: proposal.width ?? .infinity)
        return CGSize(width: proposal.width ?? 0, height: (rows.last?.maxY ?? 0))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for (frame, subview) in zip(arrange(subviews, width: bounds.width), subviews) {
            subview.place(at: CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY), proposal: .unspecified)
        }
    }

    private func arrange(_ subviews: Subviews, width: CGFloat) -> [CGRect] {
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
        return subviews.map { subview in
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > width, x > 0 { x = 0; y += rowHeight + spacing; rowHeight = 0 }
            defer { x += size.width + spacing; rowHeight = max(rowHeight, size.height) }
            return CGRect(origin: CGPoint(x: x, y: y), size: size)
        }
    }
}
