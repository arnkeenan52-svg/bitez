import Foundation

/// The rabbit's state. Each case maps to one artwork file in Assets.xcassets.
enum Mood: String, CaseIterable {
    case idle, hungry, starving, fed, proud, sleepy
    case excited, thinking, sad, love, surprised, cheering

    /// Image set name in Assets.xcassets, e.g. "rabbit_hungry".
    var assetName: String { "rabbit_\(rawValue)" }

    /// What the rabbit says on the Today screen in this state.
    var line: String {
        switch self {
        case .idle:      return "All good here. See you at the next feed."
        case .hungry:    return "Getting peckish. Feed me soon?"
        case .starving:  return "I'm past due. Flour and water, please."
        case .fed:       return "That hit the spot. Thank you."
        case .proud:     return "Look at us go."
        case .sleepy:    return "Resting up. Nothing due tonight."
        case .excited:   return "Something's happening in the jar."
        case .thinking:  return "Ask me anything about your starter."
        case .sad:       return "We lost the streak. Let's start again."
        case .love:      return "You've kept this up. I noticed."
        case .surprised: return "Bubbles. Actual bubbles."
        case .cheering:  return "You've got this."
        }
    }
}

extension Mood {
    /// Derives the mood from feeding history and time of day.
    /// - Parameters:
    ///   - lastFed: when the starter was last fed, nil if never.
    ///   - interval: the user's chosen feeding interval.
    ///   - now: injected for testability.
    static func current(lastFed: Date?, interval: TimeInterval, now: Date = .now) -> Mood {
        guard let lastFed else { return .cheering }

        let elapsed = now.timeIntervalSince(lastFed)

        // Just fed wins over everything — the reward should always land.
        if elapsed < 30 * 60 { return .fed }

        if elapsed > interval * 1.5 { return .starving }
        if elapsed > interval * 0.85 { return .hungry }

        // Quiet hours: only when nothing is actually due.
        let hour = Calendar.current.component(.hour, from: now)
        if hour >= 22 || hour < 6 { return .sleepy }

        return .idle
    }
}
