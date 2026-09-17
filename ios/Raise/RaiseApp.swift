import SwiftUI

@main
struct RaiseApp: App {
    @StateObject private var store = StarterStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .preferredColorScheme(.light)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var store: StarterStore

    var body: some View {
        if store.hasOnboarded {
            TodayView()
                .transition(.opacity)
        } else {
            OnboardingFlow()
                .transition(.opacity)
        }
    }
}
