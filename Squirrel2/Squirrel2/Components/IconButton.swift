//
//  IconButton.swift
//  Squirrel2
//
//  Reusable icon button component with Liquid Glass style (iOS 26+)
//  Uses explicit padding with .glassEffect() for precise sizing control
//

import SwiftUI

enum IconButtonVariant {
    case primary    // Black background (no glass)
    case secondary  // Glass effect
    case composer   // Glass effect, sized for composer (48x48)
}

enum IconButtonSize {
    case small      // 44x44 rendered
    case medium     // 48x48 rendered
    
    /// Icon size for system icons (SF Symbols)
    var systemIconSize: CGFloat {
        switch self {
        case .small: return 20
        case .medium: return 24
        }
    }
    
    /// Icon size for custom asset icons
    var assetIconSize: CGFloat {
        switch self {
        case .small: return 24
        case .medium: return 32
        }
    }
    
    /// Padding around icon to achieve target rendered size
    /// Formula: targetSize = iconSize + (padding * 2) + ~5px glassEffect border
    var padding: CGFloat {
        switch self {
        case .small: return 10   // 20 + 10*2 + ~4px glass border = 44px
        case .medium: return 10  // 24 + 10*2 + ~4px glass border = 48px
        }
    }
    
    /// Total rendered size
    var renderedSize: CGFloat {
        switch self {
        case .small: return 44
        case .medium: return 48
        }
    }
}

struct IconButton: View {
    let icon: String
    let isSystemIcon: Bool
    let variant: IconButtonVariant
    let size: IconButtonSize
    let action: () -> Void
    
    init(icon: String, isSystemIcon: Bool = false, variant: IconButtonVariant = .secondary, size: IconButtonSize = .small, action: @escaping () -> Void) {
        self.icon = icon
        self.isSystemIcon = isSystemIcon
        self.variant = variant
        self.size = size
        self.action = action
    }
    
    // Composer uses fixed 48px with specific padding
    private var composerPadding: CGFloat { 14 }  // 20 + 14*2 + ~4px glass border = 52px
    
    var body: some View {
        switch variant {
        case .primary:
            Button(action: action) {
                iconContent
                    .foregroundStyle(.white)
                    .padding(size.padding)
                    .background(Circle().fill(Color.black))
            }
            .buttonStyle(.plain)
            .glassShadow()
            
        case .secondary:
            Button(action: action) {
                iconContent
                    .foregroundStyle(.primary)
                    .padding(size.padding)
            }
            .buttonStyle(.plain)
            .glassEffect(.regular.interactive(), in: .circle)
            .glassShadow()
            
        case .composer:
            Button(action: action) {
                iconContent
                    .foregroundStyle(.primary)
                    .padding(composerPadding)
            }
            .buttonStyle(.plain)
            .glassEffect(.regular.interactive(), in: .circle)
            .glassShadow()
        }
    }
    
    @ViewBuilder
    private var iconContent: some View {
        if isSystemIcon {
            Image(systemName: icon)
                .font(.system(size: size.systemIconSize, weight: .medium))
        } else {
            Image(icon)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: size.assetIconSize, height: size.assetIconSize)
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        // Custom icons
        HStack(spacing: 20) {
            IconButton(icon: "Menu") {}
            IconButton(icon: "ThreeDot") {}
        }
        
        // System icons
        HStack(spacing: 20) {
            IconButton(icon: "line.3.horizontal", isSystemIcon: true) {}
            IconButton(icon: "ellipsis", isSystemIcon: true) {}
            IconButton(icon: "gearshape", isSystemIcon: true) {}
        }
    }
    .padding(40)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color(UIColor.systemGray6))
}

