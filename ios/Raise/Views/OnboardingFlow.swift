import SwiftUI

/// Three screens: the promise, the name, the reminder time.
/// Everything else from the mockups is a question you can add later —
/// these three are the ones that change what the app does.
struct OnboardingFlow: View {
    @EnvironmentObject private var store: StarterStore
    @State private var step = 0

    var body: some View {
        ZStack {
            GroundBackground()

            VStack(spacing: 0) {
                ProgressBar(step: step, total: 3)
                    .padding(.horizontal, 24)
                    .padding(.top, 8)

                TabView(selection: $step) {
                    WelcomeStep(onNext: next).tag(0)
                    NameStep(onNext: next).tag(1)
                    ReminderStep(onDone: finish).tag(2)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.easeInOut(duration: 0.25), value: step)
            }
        }
    }

    private func next() {
        withAnimation { step = min(step + 1, 2) }
    }

    private func finish() {
        Task {
            await NotificationManager.shared.requestAuthorization()
            await NotificationManager.shared.scheduleDailyReminder(
                at: store.reminderMinute,
                rabbitName: store.rabbitName
            )
            withAnimation { store.completeOnboarding() }
        }
    }
}

// MARK: - Progress

private struct ProgressBar: View {
    let step: Int
    let total: Int

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.ink.opacity(0.08))
                Capsule()
                    .fill(Theme.ink)
                    .frame(width: geo.size.width * CGFloat(step + 1) / CGFloat(total))
                    .animation(.easeOut(duration: 0.3), value: step)
            }
        }
        .frame(height: 5)
    }
}

// MARK: - Step 1

private struct WelcomeStep: View {
    let onNext: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 24)

            Text("Bake your first sourdough")
                .font(Theme.display(42))
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)

            Text("Ten days. One feed a day. We'll tell you when.")
                .font(Theme.body(17))
                .foregroundStyle(Theme.inkSoft)
                .multilineTextAlignment(.center)
                .padding(.top, 14)
                .padding(.horizontal, 40)

            RabbitView(mood: .cheering, size: 260)
                .padding(.top, 12)

            Spacer(minLength: 12)

            Button("Get started", action: onNext)
                .buttonStyle(PillButtonStyle())
                .padding(.horizontal, 32)
                .padding(.bottom, 28)
        }
    }
}

// MARK: - Step 2

private struct NameStep: View {
    @EnvironmentObject private var store: StarterStore
    @FocusState private var focused: Bool
    let onNext: () -> Void

    private let suggestions = ["Rocky", "Doris", "Bubbles", "Klump", "Surdej", "Nigel"]

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 24)

            Text("Name your rabbit")
                .font(Theme.display(34))
                .foregroundStyle(Theme.ink)

            Text("He'll be with you for the next ten days.")
                .font(Theme.body(16))
                .foregroundStyle(Theme.inkSoft)
                .padding(.top, 8)

            TextField("Rocky", text: $store.rabbitName)
                .font(Theme.display(38))
                .multilineTextAlignment(.center)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .focused($focused)
                .padding(.top, 28)
                .padding(.horizontal, 32)

            Rectangle()
                .fill(Theme.ink.opacity(0.12))
                .frame(height: 2)
                .padding(.horizontal, 60)
                .padding(.top, 6)

            Button {
                store.rabbitName = suggestions.randomElement() ?? "Rocky"
            } label: {
                Label("Surprise me", systemImage: "dice")
                    .font(Theme.label(15))
                    .foregroundStyle(Theme.inkSoft)
            }
            .padding(.top, 18)

            RabbitView(mood: .love, size: 200)
                .padding(.top, 8)

            Spacer(minLength: 12)

            Button("Next", action: onNext)
                .buttonStyle(PillButtonStyle())
                .disabled(store.rabbitName.trimmingCharacters(in: .whitespaces).isEmpty)
                .opacity(store.rabbitName.trimmingCharacters(in: .whitespaces).isEmpty ? 0.4 : 1)
                .padding(.horizontal, 32)
                .padding(.bottom, 28)
        }
        .onTapGesture { focused = false }
    }
}

// MARK: - Step 3

private struct ReminderStep: View {
    @EnvironmentObject private var store: StarterStore
    let onDone: () -> Void

    /// Bridges the stored minute-of-day to a real time picker.
    private var reminderTime: Binding<Date> {
        Binding(
            get: {
                Calendar.current.date(
                    bySettingHour: store.reminderMinute / 60,
                    minute: store.reminderMinute % 60,
                    second: 0,
                    of: .now
                ) ?? .now
            },
            set: { newValue in
                let parts = Calendar.current.dateComponents([.hour, .minute], from: newValue)
                store.reminderMinute = (parts.hour ?? 8) * 60 + (parts.minute ?? 0)
            }
        )
    }

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 24)

            Text("When should \(store.rabbitName) nudge you?")
                .font(Theme.display(32))
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)

            Text("One reminder a day. Pick a time you're near the kitchen.")
                .font(Theme.body(16))
                .foregroundStyle(Theme.inkSoft)
                .multilineTextAlignment(.center)
                .padding(.top, 10)
                .padding(.horizontal, 36)

            DatePicker("", selection: reminderTime, displayedComponents: .hourAndMinute)
                .datePickerStyle(.wheel)
                .labelsHidden()
                .padding(.top, 10)

            RabbitView(mood: .idle, size: 170)

            Spacer(minLength: 12)

            Button("Turn on reminders", action: onDone)
                .buttonStyle(PillButtonStyle())
                .padding(.horizontal, 32)

            Button("Set up later") {
                store.completeOnboarding()
            }
            .font(Theme.label(15))
            .foregroundStyle(Theme.inkSoft)
            .padding(.top, 14)
            .padding(.bottom, 24)
        }
    }
}

#Preview {
    OnboardingFlow().environmentObject(StarterStore())
}
