import XCTest

/// The installed app driven by real native touches (scripts/native-ios-ui.sh runs it headless on a task simulator):
/// boot → title → ENTER WORLD → play → touch PAUSE → Home / foreground stays paused (ws:background) → Resume.
/// Screenshots are attached to the .xcresult (the runner exports them), for eyes — the assertions are the gate.
final class GameTouchTests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "com.jakeverbaten.wildshard-singleplayer")

    override func setUpWithError() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .landscapeLeft // hold the (simulated) phone the way the landscape-only game is played
        app.launch()
    }

    private func button(_ label: String) -> XCUIElement {
        // contains, not begins-with: the touch pause button's label is "❚❚PAUSE"
        app.webViews.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", label)).firstMatch
    }

    private func tap(_ element: XCUIElement, timeout: TimeInterval = 60, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(element.waitForExistence(timeout: timeout), "missing: \(element)", file: file, line: line)
        let hittable = NSPredicate { _, _ in element.isHittable }
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: hittable, object: nil)], timeout: timeout), .completed,
                       "not touchable: \(element)", file: file, line: line)
        element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }

    /// true when `element` becomes (or stops being) touchable within `timeout` — a closed menu stays in the DOM
    private func becomes(_ element: XCUIElement, hittable: Bool, timeout: TimeInterval) -> Bool {
        let p = NSPredicate { _, _ in element.exists && element.isHittable == hittable || !hittable && !element.exists }
        return XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: p, object: nil)], timeout: timeout) == .completed
    }

    private func shot(_ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }

    func testEnterWorldPauseBackgroundResume() {
        // the title (shard deck) appears once the boot plan — downloads, shaders, first frames — has finished
        let enter = button("Enter world")
        XCTAssertTrue(enter.waitForExistence(timeout: 300), "the title screen never appeared")
        // WKWebView exposes the title's buttons to accessibility while the loading panel still covers them (found
        // by trials-gauntlet): wait for the panel ("Loading chunk · <slug>") to be removed before touching anything
        let loader = app.webViews.staticTexts.matching(NSPredicate(format: "label BEGINSWITH[c] %@", "Loading chunk")).firstMatch
        let gone = NSPredicate { _, _ in !loader.exists }
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: gone, object: nil)], timeout: 600), .completed, "the boot never finished")
        shot("1-title")
        tap(enter)
        sleep(12) // let the world render and settle
        shot("2-in-world")

        tap(button("Pause"))
        let resume = button("Resume")
        XCTAssertTrue(becomes(resume, hittable: true, timeout: 15), "PAUSE must open the menu")
        shot("3-paused")

        // background → foreground: the game must still be paused (the shell's ws:background never unpauses)
        tap(resume)
        XCTAssertTrue(becomes(resume, hittable: false, timeout: 5), "Resume should close the menu")
        XCUIDevice.shared.press(.home)
        sleep(3)
        app.activate()
        XCTAssertTrue(becomes(resume, hittable: true, timeout: 15), "coming back from the background must land paused")
        shot("4-back-from-background")
        tap(resume)
        sleep(4)
        shot("5-resumed")
    }
}
