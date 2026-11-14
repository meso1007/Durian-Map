import SwiftUI

/// Durian Map（ネイティブ iOS 版）。チェーン店を除いた個人経営のカフェを地図で探す。
///
/// 画面も状態もこのアプリの中で完結する。サーバーは Web 版と同じ検索 API（Cloudflare Workers）を使う。
/// チェーン店の判定は API 側だけが持つ（`backend/src/chains.ts`）。こちらで書き直さないこと。
@main
struct DurianMapApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(model)
                .tint(Brand.green)
        }
    }
}

/// ブランドの色（docs/design-tokens.md）。ガラスの面そのものには色を付けず、操作と状態にだけ使う。
enum Brand {
    static let green = Color(red: 0x1F / 255, green: 0x6B / 255, blue: 0x3F / 255)
    static let deepGreen = Color(red: 0x17 / 255, green: 0x49 / 255, blue: 0x2E / 255)
    static let mango = Color(red: 0xF6 / 255, green: 0xA2 / 255, blue: 0x1B / 255)
    static let mangoDeep = Color(red: 0xD9 / 255, green: 0x77 / 255, blue: 0x06 / 255)
    static let hibiscus = Color(red: 0xB3 / 255, green: 0x16 / 255, blue: 0x4F / 255)
    static let star = Color(red: 0xF2 / 255, green: 0xB7 / 255, blue: 0x05 / 255)
}
