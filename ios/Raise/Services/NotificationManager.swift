import Foundation
import UserNotifications

/// Local notifications only — no server, no paid developer account needed.
final class NotificationManager {
    static let shared = NotificationManager()
    private let center = UNUserNotificationCenter.current()
    private let dailyID = "raise.daily.feed"

    private init() {}

    @discardableResult
    func requestAuthorization() async -> Bool {
        do {
            return try await center.requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            return false
        }
    }

    /// One repeating reminder at the user's chosen time.
    /// - Parameter minute: minutes past midnight, e.g. 480 for 08:00.
    func scheduleDailyReminder(at minute: Int, rabbitName: String) async {
        center.removePendingNotificationRequests(withIdentifiers: [dailyID])

        var components = DateComponents()
        components.hour = minute / 60
        components.minute = minute % 60

        let content = UNMutableNotificationContent()
        content.title = "\(rabbitName) is hungry"
        content.body = "Time to feed your starter. Takes two minutes."
        content.sound = .default

        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
        let request = UNNotificationRequest(identifier: dailyID, content: content, trigger: trigger)

        try? await center.add(request)
    }

    /// Fires in `seconds` — use this to prove notifications work without
    /// waiting until tomorrow morning.
    func scheduleTestPing(in seconds: TimeInterval = 10, rabbitName: String) async {
        let content = UNMutableNotificationContent()
        content.title = "\(rabbitName) is hungry"
        content.body = "Time to feed your starter. Takes two minutes."
        content.sound = .default

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(seconds, 1), repeats: false)
        let request = UNNotificationRequest(identifier: UUID().uuidString,
                                            content: content,
                                            trigger: trigger)
        try? await center.add(request)
    }

    func cancelAll() {
        center.removeAllPendingNotificationRequests()
    }
}
