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

    @MainActor func testDark() { run("dark") }
    @MainActor func testLight() { run("light") }

    /// ホーム → 検索結果 → 絞り込み → 詳細 → 保存 → 保存タブ、の順に撮る。
    /// 保存はテストが足した分だけ最後に外す（端末にある保存の一覧を変えないため）。
    @MainActor
    private func run(_ scheme: String) {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTestScheme", scheme]
        app.launch()
        sleep(3)
        shot("\(scheme)-1-home")

        let area = app.buttons["谷中"]
        if area.waitForExistence(timeout: 5) { area.tap() }
        sleep(6)
        shot("\(scheme)-2-results")

        let openNow = app.buttons["営業中"]
        if openNow.exists { openNow.tap(); sleep(1) }
        shot("\(scheme)-3-filtered")
        if openNow.exists { openNow.tap(); sleep(1) }

        let firstRow = app.buttons.matching(identifier: "cafe-row").firstMatch
        if firstRow.exists { firstRow.tap() }
        sleep(4)

        let save = app.buttons["保存"]
        // 前回のテストが途中で止まり、足した保存が残ったときは CLEAN_LEFTOVER=1 で外す
        // （xcodebuild には TEST_RUNNER_CLEAN_LEFTOVER=1 として渡す）。
        let savedByTest = save.exists || ProcessInfo.processInfo.environment["CLEAN_LEFTOVER"] == "1"
        if savedByTest { save.tap(); sleep(1) }
        shot("\(scheme)-4-detail-saved")

        // 写真を横にスワイプして 2 枚目を出す。
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.2))
            .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.2)))
        sleep(3)
        shot("\(scheme)-4b-photo-swiped")

        app.swipeUp()
        sleep(1)
        shot("\(scheme)-5-detail-scrolled")

        let back = app.buttons["一覧に戻る"]
        app.swipeDown()
        if back.waitForExistence(timeout: 2) { back.tap(); sleep(1) }
        let savedTab = app.segmentedControls.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "保存")).firstMatch
        if savedTab.exists { savedTab.tap(); sleep(2) }
        shot("\(scheme)-6-saved-tab")

        if savedByTest {
            let searchTab = app.segmentedControls.buttons["さがす"]
            if searchTab.exists { searchTab.tap(); sleep(1) }
            if firstRow.exists { firstRow.tap(); sleep(2) }
            let unsave = app.buttons["保存済み"]
            if unsave.waitForExistence(timeout: 3) { unsave.tap(); sleep(1) }
        }
        // 後始末のあと。テストが足した保存が残っていないことを確かめる。
        if back.waitForExistence(timeout: 2) { back.tap(); sleep(1) }
        if savedTab.exists { savedTab.tap(); sleep(1) }
        shot("\(scheme)-7-after-cleanup")
    }
}
