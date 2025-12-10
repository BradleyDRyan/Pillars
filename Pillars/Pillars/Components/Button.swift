//
//  Button.swift
//  Squirrel2
//
//  Design system button supporting icon + label with glass styling
//

import SwiftUI

enum S2ButtonVariant {
    case primary    // Filled black
    case secondary  // Glass / elevated surface
    case ghost      // Outline only
}

enum S2ButtonSize {
    case small
    case medium
    
    var verticalPadding: CGFloat {
        switch self {
        case .small: return 10
        case .medium: return 14
        }
    }
    
    var horizontalPadding: CGFloat {
        switch self {
        case .small: return 14
        case .medium: return 16
        }
    }
    
    var font: Font {
        switch self {
        case .small: return .system(size: 15, weight: .semibold)
        case .medium: return .system(size: 17, weight: .semibold)
        }
    }
}

/// Design-system button that can display an icon and text.
/// Named S2Button to avoid conflicts with SwiftUI.Button
struct S2Button: View {
    let title: String
    let icon: String?
    let isSystemIcon: Bool
    let variant: S2ButtonVariant
    let size: S2ButtonSize
    let fullWidth: Bool
    let centerContent: Bool
    let action: () -> Void
    
    init(
        title: String,
        icon: String? = nil,
        isSystemIcon: Bool = true,
        variant: S2ButtonVariant = .primary,
        size: S2ButtonSize = .medium,
        fullWidth: Bool = true,
        centerContent: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.isSystemIcon = isSystemIcon
        self.variant = variant
        self.size = size
        self.fullWidth = fullWidth
        self.centerContent = centerContent
        self.action = action
    }
    
    var body: some View {
        SwiftUI.Button(action: action) {
            HStack(spacing: 10) {
                if centerContent && fullWidth {
                    Spacer(minLength: 0)
                }
                
                if let icon = icon {
                    iconView(icon: icon)
                }
                
                Text(title)
                    .font(size.font)
                
                if centerContent && fullWidth {
                    Spacer(minLength: 0)
                } else if fullWidth {
                    Spacer(minLength: 0)
                }
            }
            .foregroundColor(foregroundColor)
            .padding(.horizontal, size.horizontalPadding)
            .padding(.vertical, size.verticalPadding)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .background(background)
        }
        .buttonStyle(.plain)
        .glassShadow()
    }
    
    @ViewBuilder
    private func iconView(icon: String) -> some View {
        if isSystemIcon {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
        } else {
            Image(icon)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 18, height: 18)
        }
    }
    
    @ViewBuilder
    private var background: some View {
        switch variant {
        case .primary:
            Capsule(style: .continuous)
                .fill(Color.black)
        case .secondary:
            Capsule(style: .continuous)
                .fill(S2.Colors.secondarySurface)
                .glassEffect(.regular.interactive(), in: .capsule)
        case .ghost:
            Capsule(style: .continuous)
                .stroke(S2.Colors.secondaryText.opacity(0.4), lineWidth: 1)
        }
    }
    
    private var foregroundColor: Color {
        switch variant {
        case .primary: return .white
        case .secondary: return S2.Colors.primaryText
        case .ghost: return S2.Colors.primaryText
        }
    }
}

#Preview {
    VStack(spacing: 16) {
        S2Button(title: "Primary", icon: "paperplane.fill", variant: .primary) {}
        S2Button(title: "Secondary", icon: "paperclip", variant: .secondary) {}
        S2Button(title: "Ghost", icon: "ellipsis", variant: .ghost, fullWidth: false) {}
        S2Button(title: "Text Only", variant: .primary, fullWidth: false) {}
    }
    .padding()
    .background(S2.Colors.primarySurface)
}

