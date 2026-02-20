//
//  DesignSystem.swift
//  Squirrel2
//
//  Central design system with colors, typography, spacing, and components
//

import SwiftUI

// MARK: - Design System
struct S2 {

    // MARK: - Colors
    struct Colors {
        // Surface Colors
        static let primarySurface = Color(lightMode: Color.white, darkMode: Color(hex: "111112"))
        static let secondarySurface = Color(lightMode: Color(hex: "F3F4F5"), darkMode: Color(hex: "28292B"))
        static let tertiarySurface = Color(lightMode: Color.white, darkMode: Color(hex: "383B3D"))
        static let elevated = Color(lightMode: Color.white, darkMode: Color(hex: "28292B"))
        static let tinted = Color(lightMode: Color(hex: "F3F4F5"), darkMode: Color(hex: "383B3D"))

        // Text Colors
        static let primaryText = Color(lightMode: Color.black.opacity(0.93), darkMode: Color(hex: "F3F4F5"))
        static let secondaryText = Color(lightMode: Color(hex: "686A6E"), darkMode: Color(hex: "A1A4A8"))
        static let tertiaryText = Color(lightMode: Color(hex: "A1A4A8"), darkMode: Color(hex: "686A6E"))

        // Icon Colors
        static let primaryIcon = Color(lightMode: Color(hex: "111112"), darkMode: Color(hex: "F3F4F5"))
        static let secondaryIcon = Color(lightMode: Color(hex: "686A6E"), darkMode: Color(hex: "A1A4A8"))
        static let tertiaryIcon = Color(lightMode: Color(hex: "A1A4A8"), darkMode: Color(hex: "686A6E"))

        // Brand Colors
        static let primaryBrand = Color.black // Black primary
        static let secondaryBrand = Color(hex: "EE7733") // Warm orange
        static let accentGreen = Color(hex: "25B159") // Success green
        static let error = Color(lightMode: Color(hex: "D31130"), darkMode: Color(hex: "FF5668"))

        // Additional Brown Colors
        static let squirrelAccent = Color(red: 0.800, green: 0.600, blue: 0.400) // Warm beige
        static let squirrelWarmGray = Color(red: 0.733, green: 0.700, blue: 0.667) // Warm gray

        // Background Colors
        static let primaryBackground = Color.white
        static let groupedBackground = Color(hex: "F9F9F8")
        static let squirrelBackground = Color(hex: "FFFBF5") // Warm white
        static let squirrelWarmBackground = Color(hex: "FFFBF5") // Warm white
        static let squirrelSurfaceBackground = Color(hex: "F2EBDB") // Warm gray surface
        static let squirrelWarmGrayBackground = Color(hex: "F2EBDB") // Warm gray

        // Message Bubble Colors
        static let userMessageBackground = Color(hex: "007AFF") // iOS blue
        static let assistantMessageBackground = Color(hex: "E5E5EA") // iOS gray

        // UI Element Colors
        static let squirrelDivider = Color.secondary.opacity(0.3)
        static let squirrelShadow = Color.black.opacity(0.08)

        // Legacy support aliases
        static let squirrelPrimary = primaryBrand
        static let squirrelSecondary = secondaryBrand
        static let squirrelTextPrimary = primaryText
        static let squirrelTextSecondary = secondaryText
    }

    // MARK: - Typography
    struct Typography {
        // Title styles
        static func largeTitle(_ text: String) -> some View {
            Text(text)
                .font(.system(size: 34, weight: .bold))
        }

        static func title1(_ text: String) -> some View {
            Text(text)
                .font(.system(size: 34, weight: .semibold, design: .default))
        }

        static func title2(_ text: String) -> some View {
            Text(text)
                .font(.system(size: 22, weight: .semibold))
        }

        static func title3(_ text: String) -> some View {
            Text(text)
                .font(.system(size: 20, weight: .semibold))
        }

        // Body styles
        static func headline(_ text: String) -> some View {
            Text(text)
                .font(.system(size: 17, weight: .semibold))
        }

        static func body(_ text: String) -> some View {
            Text(text)
                .font(.system(size: 17, weight: .regular))
        }

        static func callout(_ text: String) -> some View {
            Text(text)
                .font(.system(size: 16, weight: .regular))
        }

        static func subheadline(_ text: String) -> some View {
            Text(text)
                .font(.system(size: 15, weight: .regular))
        }

        static func footnote(_ text: String) -> some View {
            Text(text)
                .font(.system(size: 13, weight: .regular))
        }

        static func caption1(_ text: String) -> some View {
            Text(text)
                .font(.system(size: 12, weight: .regular))
        }

        static func caption2(_ text: String) -> some View {
            Text(text)
                .font(.system(size: 11, weight: .regular))
        }
    }

    // MARK: - Type Tokens (Apple Naming)
    struct TextStyle {
        // Apple-native text styles using system fonts only
        static let largeTitle = Font.largeTitle
        static let title = Font.title
        static let title2 = Font.title2
        static let title3 = Font.title3
        static let headline = Font.headline
        static let body = Font.body
        static let callout = Font.callout
        static let subheadline = Font.subheadline
        static let footnote = Font.footnote
        static let caption = Font.caption
        static let caption2 = Font.caption2
    }

    // MARK: - Spacing
    struct Spacing {
        static let none: CGFloat = 0
        static let xxs: CGFloat = 2
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 20
        static let xxl: CGFloat = 24
        static let xxxl: CGFloat = 32
    }

    // MARK: - Corner Radius
    struct CornerRadius {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 20
        static let pill: CGFloat = 999
    }

    // MARK: - Shadows
    struct Shadow {
        static let sm = (color: Color.black.opacity(0.05), radius: CGFloat(4), x: CGFloat(0), y: CGFloat(2))
        static let md = (color: Color.black.opacity(0.1), radius: CGFloat(8), x: CGFloat(0), y: CGFloat(4))
        static let lg = (color: Color.black.opacity(0.15), radius: CGFloat(16), x: CGFloat(0), y: CGFloat(8))
        /// Shadow for glass/liquid glass components (buttons, inputs, etc.)
        static let glass = (color: Color.black.opacity(0.04), radius: CGFloat(4), x: CGFloat(0), y: CGFloat(2))
        /// Elevated glass shadow for lifted states
        static let glassElevated = (color: Color.black.opacity(0.12), radius: CGFloat(16), x: CGFloat(0), y: CGFloat(8))
    }
    
    // MARK: - Glass Colors
    struct Glass {
        /// Base tint for light mode glass
        static let lightTint = Color.white.opacity(0.7)
        /// Base tint for dark mode glass
        static let darkTint = Color(hex: "1C1C1E").opacity(0.7)
        /// Highlight color for specular effects
        static let highlight = Color.white
        /// Border color for glass edges
        static let border = Color.white.opacity(0.2)
        /// Inner shadow for depth
        static let innerShadow = Color.black.opacity(0.05)
        
        /// Dynamic glass background that adapts to color scheme
        static func background(for colorScheme: ColorScheme) -> Color {
            colorScheme == .dark ? darkTint : lightTint
        }
    }

    // MARK: - Elevation
    struct Elevation {
        static func level1(_ view: some View) -> some View {
            view
                .shadow(color: Color.black.opacity(0.03), radius: 3, x: 0, y: 2)
                .shadow(color: Color.black.opacity(0.03), radius: 2, x: 0, y: 1)
        }

        static func level2(_ view: some View) -> some View {
            view
                .shadow(color: Color.black.opacity(0.05), radius: 5, x: 0, y: 3)
                .shadow(color: Color.black.opacity(0.05), radius: 3, x: 0, y: 2)
        }

        static func level3(_ view: some View) -> some View {
            view
                .shadow(color: Color.black.opacity(0.08), radius: 8, x: 0, y: 4)
                .shadow(color: Color.black.opacity(0.08), radius: 4, x: 0, y: 2)
        }
    }
}

// MARK: - Shadow View Modifier
extension View {
    /// Applies the standard glass shadow for liquid glass components
    func glassShadow() -> some View {
        self.shadow(
            color: S2.Shadow.glass.color,
            radius: S2.Shadow.glass.radius,
            x: S2.Shadow.glass.x,
            y: S2.Shadow.glass.y
        )
    }
}

// MARK: - Color Extension for Light/Dark Mode
extension Color {
    /// Creates a dynamic color that adapts to light/dark mode
    /// Named uniquely to avoid conflicts with MarkdownUI
    init(lightMode: Color, darkMode: Color) {
        self.init(UIColor { traitCollection in
            switch traitCollection.userInterfaceStyle {
            case .dark:
                return UIColor(darkMode)
            default:
                return UIColor(lightMode)
            }
        })
    }

    // Hex color initializer
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Font Extensions
extension Font {
    // Headings - Using Optimistic AI VF
    static let squirrelLargeTitle = Font.optimistic(size: 34, weight: .bold)
    static let squirrelTitle = Font.optimistic(size: 28, weight: .bold)
    static let squirrelTitle2 = Font.optimistic(size: 22, weight: .semibold)
    static let squirrelTitle3 = Font.optimistic(size: 20, weight: .semibold)

    // Body text - Using Optimistic AI VF
    static let squirrelHeadline = Font.optimistic(size: 17, weight: .semibold)
    static let squirrelBody = Font.optimistic(size: 17, weight: .regular)
    static let squirrelCallout = Font.optimistic(size: 16, weight: .regular)
    static let squirrelSubheadline = Font.optimistic(size: 15, weight: .regular)
    // Medium-leaning subheadline without the overly bold medium weight
    static let squirrelSubheadlineMedium = Font.optimistic(size: 15, weight: .regular)
    static let squirrelFootnote = Font.optimistic(size: 13, weight: .regular)
    static let squirrelCaption = Font.optimistic(size: 12, weight: .regular)

    // Chat specific - Using Optimistic AI VF
    static let squirrelChatMessage = Font.optimisticChatMessage
    static let squirrelChatTimestamp = Font.optimisticChatTimestamp
    static let squirrelChatInput = Font.optimistic(size: 17, weight: .regular)

    // Buttons - Using Optimistic AI VF
    static let squirrelButtonPrimary = Font.optimistic(size: 16, weight: .semibold)
    static let squirrelButtonSecondary = Font.optimistic(size: 14, weight: .medium)
    
    // Fallback system fonts (if Optimistic is not available)
    static let squirrelLargeTitleFallback = Font.system(size: 34, weight: .bold, design: .rounded)
    static let squirrelTitleFallback = Font.system(size: 28, weight: .bold, design: .rounded)
    static let squirrelTitle2Fallback = Font.system(size: 22, weight: .semibold, design: .rounded)
    static let squirrelTitle3Fallback = Font.system(size: 20, weight: .semibold, design: .rounded)
    static let squirrelHeadlineFallback = Font.system(size: 17, weight: .semibold, design: .default)
    static let squirrelBodyFallback = Font.system(size: 17, weight: .regular, design: .default)
    static let squirrelCalloutFallback = Font.system(size: 16, weight: .regular, design: .default)
    static let squirrelSubheadlineFallback = Font.system(size: 15, weight: .regular, design: .default)
    static let squirrelFootnoteFallback = Font.system(size: 13, weight: .regular, design: .default)
    static let squirrelChatMessageFallback = Font.system(size: 16, weight: .regular, design: .default)
    static let squirrelChatTimestampFallback = Font.system(size: 11, weight: .regular, design: .default)
    static let squirrelChatInputFallback = Font.system(size: 17, weight: .regular, design: .default)
    static let squirrelButtonPrimaryFallback = Font.system(size: 16, weight: .semibold, design: .rounded)
    static let squirrelButtonSecondaryFallback = Font.system(size: 14, weight: .medium, design: .rounded)
}

/// Standard top-of-screen text header for primary tab screens.
struct S2ScreenHeaderView: View {
    let title: String

    var body: some View {
        Text(title)
            .font(S2.TextStyle.title2)
            .foregroundColor(S2.Colors.primaryText)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - View Extensions
extension View {
    func s2Card() -> some View {
        self
            .background(S2.Colors.elevated)
            .cornerRadius(S2.CornerRadius.md)
            .shadow(color: S2.Shadow.sm.color, radius: S2.Shadow.sm.radius, x: S2.Shadow.sm.x, y: S2.Shadow.sm.y)
    }

    func s2Surface() -> some View {
        self
            .background(S2.Colors.secondarySurface)
            .cornerRadius(S2.CornerRadius.sm)
    }

    // Elevation helpers
    func elevation1() -> some View {
        S2.Elevation.level1(self)
    }

    func elevation2() -> some View {
        S2.Elevation.level2(self)
    }

    func elevation3() -> some View {
        S2.Elevation.level3(self)
    }
}
