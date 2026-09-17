import SwiftUI

/// Single source of truth for colour and type.
/// One ground, one accent — everything else is neutral.
enum Theme {
    static let ground      = Color(hex: 0xEDF4FB)   // pale blue page
    static let groundDeep  = Color(hex: 0xDCE9F6)   // gradient foot
    static let surface     = Color.white
    static let ink         = Color(hex: 0x1C1F23)   // headlines, pill buttons
    static let inkSoft     = Color(hex: 0x6B7280)   // body copy
    static let accent      = Color(hex: 0xC85A3C)   // terracotta

    static let warn        = Color(hex: 0xE8A020)
    static let good        = Color(hex: 0x3FB86A)

    static func display(_ size: CGFloat) -> Font {
        .system(size: size, weight: .heavy, design: .default)
    }
    static func body(_ size: CGFloat = 16) -> Font {
        .system(size: size, weight: .regular)
    }
    static func label(_ size: CGFloat = 16) -> Font {
        .system(size: size, weight: .semibold)
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red:   Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >>  8) & 0xFF) / 255,
            blue:  Double( hex        & 0xFF) / 255,
            opacity: 1
        )
    }
}

/// The black pill used for every primary action.
struct PillButtonStyle: ButtonStyle {
    var filled: Bool = true

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.label(18))
            .foregroundStyle(filled ? Color.white : Theme.ink)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 18)
            .background(filled ? Theme.ink : Color.clear, in: Capsule())
            .opacity(configuration.isPressed ? 0.85 : 1)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// Page background used on every screen so the app reads as one system.
struct GroundBackground: View {
    var body: some View {
        LinearGradient(
            colors: [Theme.ground, Theme.groundDeep],
            startPoint: .top,
            endPoint: .bottom
        )
        .ignoresSafeArea()
    }
}
