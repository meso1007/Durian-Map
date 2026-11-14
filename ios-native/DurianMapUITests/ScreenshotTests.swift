import XCTest

/// 実機（またはシミュレータ）でアプリを操作し、主要な画面のスクリーンショットを残す。
/// 見た目の確認用。合否は付けない（画面が出なくても、撮れたところまでを残す）。
///
///   xcodebuild test -scheme DurianMap -destination 'id=<端末>' -resultBundlePath out.xcresult
///   xcrun xcresulttool export attachments --path out.xcresult --output-path shots
final class ScreenshotTests: XCTestCase {
    override func setUp() { continueAfterFailure = true }

    private func shot(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    @MainActor
    func testMainScreens() {
        let app = XCUIApplication()
        app.launch()
        sleep(3)
        shot("1-home")

        // エリアのボタンから検索する。
        let area = app.buttons["谷中"]
        if area.waitForExistence(timeout: 5) { area.tap() }
        sleep(6)
        shot("2-results")

        // 一覧の 1 軒目を開く。
        let firstRow = app.scrollViews.buttons.element(boundBy: 6)
        if firstRow.exists { firstRow.tap() }
        sleep(4)
        shot("3-detail")

        app.swipeUp()
        sleep(1)
        shot("4-detail-scrolled")
    }
}
