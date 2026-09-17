import Foundation
import SwiftUI

/// All app state. UserDefaults is deliberate — this is a demo slice and the
/// whole model is five values. Swap for SwiftData when the feeding log needs
/// real history.
///
/// Note: `@AppStorage` is not used here. It is a `DynamicProperty` built for
/// views; inside an `ObservableObject` it stores fine but never fires
/// `objectWillChange`, so the UI silently stops updating. Backing `@Published`
/// with `UserDefaults` in `didSet` gives both.
@MainActor
final class StarterStore: ObservableObject {

    private enum Key {
        static let onboarded = "hasOnboarded"
        static let name      = "rabbitName"
        static let reminder  = "reminderMinute"
        static let lastFed   = "lastFedAt"
        static let started   = "startedAt"
        static let feeds     = "feedCount"
    }

    private let defaults = UserDefaults.standard

    @Published var hasOnboarded: Bool  { didSet { defaults.set(hasOnboarded, forKey: Key.onboarded) } }
    @Published var rabbitName: String  { didSet { defaults.set(rabbitName, forKey: Key.name) } }
    /// Minutes past midnight for the daily reminder. 480 = 08:00.
    @Published var reminderMinute: Int { didSet { defaults.set(reminderMinute, forKey: Key.reminder) } }
    @Published var feedCount: Int      { didSet { defaults.set(feedCount, forKey: Key.feeds) } }
    @Published var lastFed: Date?      { didSet { defaults.set(lastFed?.timeIntervalSince1970 ?? 0, forKey: Key.lastFed) } }
    @Published var startedAt: Date?    { didSet { defaults.set(startedAt?.timeIntervalSince1970 ?? 0, forKey: Key.started) } }

    /// Feed once every 24 hours during the 10-day build.
    let feedInterval: TimeInterval = 24 * 60 * 60

    init() {
        hasOnboarded   = defaults.bool(forKey: Key.onboarded)
        rabbitName     = defaults.string(forKey: Key.name) ?? "Rocky"
        let stored     = defaults.integer(forKey: Key.reminder)
        reminderMinute = stored == 0 ? 8 * 60 : stored
        feedCount      = defaults.integer(forKey: Key.feeds)

        let fed = defaults.double(forKey: Key.lastFed)
        lastFed = fed == 0 ? nil : Date(timeIntervalSince1970: fed)

        let start = defaults.double(forKey: Key.started)
        startedAt = start == 0 ? nil : Date(timeIntervalSince1970: start)
    }

    // MARK: - Derived

    var mood: Mood {
        Mood.current(lastFed: lastFed, interval: feedInterval)
    }

    /// Day 1 through 10, clamped so the UI never shows day 0 or day 11.
    var dayNumber: Int {
        guard let startedAt else { return 1 }
        let days = Calendar.current.dateComponents([.day], from: startedAt, to: .now).day ?? 0
        return min(max(days + 1, 1), 10)
    }

    var nextFeed: Date? {
        lastFed?.addingTimeInterval(feedInterval)
    }

    /// Human-readable countdown, e.g. "Next feed in 4h 20m" or "Overdue by 2h 5m".
    var nextFeedLabel: String {
        guard let nextFeed else { return "Feed to begin" }
        let delta = nextFeed.timeIntervalSinceNow
        let magnitude = abs(delta)
        let hours = Int(magnitude) / 3600
        let minutes = (Int(magnitude) % 3600) / 60
        let span = hours > 0 ? "\(hours)h \(minutes)m" : "\(minutes)m"
        return delta >= 0 ? "Next feed in \(span)" : "Overdue by \(span)"
    }

    // MARK: - Actions

    func completeOnboarding() {
        if startedAt == nil { startedAt = .now }
        hasOnboarded = true
    }

    func feed() {
        lastFed = .now
        feedCount += 1
        let name = rabbitName
        let minute = reminderMinute
        Task { await NotificationManager.shared.scheduleDailyReminder(at: minute, rabbitName: name) }
    }

    /// Wipes everything. Wired to a long-press on the Today header so you can
    /// replay onboarding on device without deleting the app.
    func reset() {
        hasOnboarded = false
        lastFed = nil
        startedAt = nil
        feedCount = 0
        NotificationManager.shared.cancelAll()
    }
}
