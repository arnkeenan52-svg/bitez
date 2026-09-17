import SwiftUI

struct TodayView: View {
    @EnvironmentObject private var store: StarterStore
    @State private var justFed = false
    /// Drives the countdown label without a timer per subview.
    @State private var tick = Date.now

    private let clock = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            GroundBackground()

            VStack(spacing: 0) {
                header

                Spacer(minLength: 0)

                RabbitView(mood: justFed ? .fed : store.mood, size: 250)

                speechBubble
                    .padding(.horizontal, 28)
                    .padding(.top, 4)

                Spacer(minLength: 0)

                statusCard
                    .padding(.horizontal, 20)

                feedButton
                    .padding(.horizontal, 24)
                    .padding(.top, 16)
                    .padding(.bottom, 24)
            }
        }
        .onReceive(clock) { tick = $0 }
    }

    // MARK: - Pieces

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Day \(store.dayNumber) of 10")
                    .font(Theme.label(13))
                    .kerning(0.8)
                    .foregroundStyle(Theme.inkSoft)
                Text(store.rabbitName)
                    .font(Theme.display(32))
                    .foregroundStyle(Theme.ink)
            }
            Spacer()
            if store.feedCount > 0 {
                HStack(spacing: 5) {
                    Image(systemName: "flame.fill")
                    Text("\(store.feedCount)")
                }
                .font(Theme.label(16))
                .foregroundStyle(Theme.accent)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Theme.surface, in: Capsule())
            }
        }
        .padding(.horizontal, 24)
        .padding(.top, 8)
        // Long-press the name to wipe state and replay onboarding on device.
        .onLongPressGesture(minimumDuration: 1.5) { store.reset() }
    }

    private var speechBubble: some View {
        Text(justFed ? Mood.fed.line : store.mood.line)
            .font(Theme.body(17))
            .foregroundStyle(Theme.ink)
            .multilineTextAlignment(.center)
            .padding(.vertical, 14)
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private var statusCard: some View {
        HStack(spacing: 14) {
            Circle()
                .fill(statusColor.opacity(0.16))
                .frame(width: 44, height: 44)
                .overlay {
                    Image(systemName: "drop.fill")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(statusColor)
                }

            VStack(alignment: .leading, spacing: 2) {
                Text(store.nextFeedLabel)
                    .font(Theme.label(16))
                    .foregroundStyle(Theme.ink)
                Text("50 g flour · 50 g water")
                    .font(Theme.body(14))
                    .foregroundStyle(Theme.inkSoft)
            }
            Spacer()
        }
        .padding(16)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        // tick is read here so the countdown refreshes on the timer.
        .id(tick)
    }

    private var feedButton: some View {
        VStack(spacing: 12) {
            Button {
                store.feed()
                withAnimation(.spring(response: 0.35, dampingFraction: 0.7)) { justFed = true }
                Task {
                    try? await Task.sleep(for: .seconds(3))
                    withAnimation { justFed = false }
                }
            } label: {
                Text("Feed \(store.rabbitName)")
            }
            .buttonStyle(PillButtonStyle())

            Button("Send a test notification") {
                Task {
                    await NotificationManager.shared.requestAuthorization()
                    await NotificationManager.shared.scheduleTestPing(in: 10,
                                                                     rabbitName: store.rabbitName)
                }
            }
            .font(Theme.label(14))
            .foregroundStyle(Theme.inkSoft)
        }
    }

    private var statusColor: Color {
        switch store.mood {
        case .starving: return Theme.accent
        case .hungry:   return Theme.warn
        default:        return Theme.good
        }
    }
}

#Preview {
    TodayView().environmentObject(StarterStore())
}
