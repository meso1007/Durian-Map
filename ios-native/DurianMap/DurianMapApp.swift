import SwiftUI
import UIKit

/// Durian Map（ネイティブ iOS 版）。チェーン店を除いた個人経営のカフェを地図で探す。
///
/// 画面も状態もこのアプリの中で完結する。サーバーは Web 版と同じ検索 API（Cloudflare Workers）を使う。
/// チェーン店の判定は API 側だけが持つ（`backend/src/chains.ts`）。こちらで書き直さないこと。
@main
struct DurianMapApp: App {
    @State private var model = AppModel()

    private static var forcedScheme: ColorScheme? {
        switch UserDefaults.standard.string(forKey: "uiTestScheme") {
        case "light": .light
        case "dark": .dark
        default: nil
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(model)
                .tint(Brand.green)
                // UI テストから見た目を固定するための引数（-uiTestScheme light / dark）。通常は端末の設定に従う。
                .preferredColorScheme(Self.forcedScheme)
        }
    }
}

/// ブランドの色（docs/design-tokens.md）。ガラスの面そのものには色を付けず、操作と状態にだけ使う。
///
/// すべてライト / ダークで値を切り替える。濃緑や濃いピンクは明るい面でしか読めないので、
/// 暗い面ではロゴのライムと、明るいピンクに替える（どちらもコントラスト 4.5:1 以上を保つため）。
enum Brand {
    private static func dynamic(_ light: UInt32, _ dark: UInt32) -> Color {
        func color(_ hex: UInt32) -> UIColor {
            UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        }
        return Color(UIColor { $0.userInterfaceStyle == .dark ? color(dark) : color(light) })
    }

    /// アクセント（主ボタン・選択中・営業中・アイコン）。
    static let green = dynamic(0x1F6B3F, 0xA8CF3B)
    /// アクセントの面に載せる文字。
    static let onAccent = dynamic(0xFFFFFF, 0x17492E)
    /// 最重要 CTA（近くからさがす）。どちらの面でも同じマンゴー。
    static let mango = dynamic(0xF6A21B, 0xF6A21B)
    /// 「いま」の線と針。
    static let mangoDeep = dynamic(0xD97706, 0xFFB020)
    /// 保存・営業時間外。
    static let hibiscus = dynamic(0xB3164F, 0xFF8FB3)
    static let star = dynamic(0xF2B705, 0xFFCB3D)
    /// 地図のピンの面。地図がダークでも沈まないよう、ピンは常に明るい面にする。
    static let pin = dynamic(0xFFFDF8, 0xFFF7E2)
    static let pinText = dynamic(0x1F3218, 0x17492E)
    /// ピンの枠。営業中だけ緑、それ以外（営業時間外・不明）は無彩色に落として、開いている店を目立たせる。
    static let pinOpen = dynamic(0x14532D, 0x14532D)
    static let pinMuted = dynamic(0x9AA096, 0x9AA096)
    /// 保存済みの印。地図の上でピンクが指すのはこれだけ。
    static let pinSaved = dynamic(0xE2467C, 0xE2467C)
}
