import SwiftUI

/// Draws the mascot for a given mood.
/// Falls back to a labelled placeholder when the image set is missing, so the
/// app still runs before the artwork is dropped into Assets.xcassets.
struct RabbitView: View {
    let mood: Mood
    var size: CGFloat = 220
    var bobbing: Bool = true

    @State private var bob = false

    var body: some View {
        Group {
            if UIImage(named: mood.assetName) != nil {
                Image(mood.assetName)
                    .resizable()
                    .scaledToFit()
            } else {
                placeholder
            }
        }
        .frame(width: size, height: size)
        .offset(y: bob ? -6 : 6)
        .animation(
            bobbing
            ? .easeInOut(duration: 1.8).repeatForever(autoreverses: true)
            : .default,
            value: bob
        )
        .onAppear { if bobbing { bob = true } }
    }

    private var placeholder: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(Theme.surface)
            VStack(spacing: 8) {
                Text("🐰").font(.system(size: size * 0.32))
                Text(mood.rawValue.uppercased())
                    .font(.system(size: 12, weight: .bold))
                    .kerning(1.2)
                    .foregroundStyle(Theme.inkSoft)
                Text("add \(mood.assetName)")
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.inkSoft.opacity(0.6))
            }
        }
    }
}

#Preview {
    ZStack {
        GroundBackground()
        RabbitView(mood: .hungry)
    }
}
