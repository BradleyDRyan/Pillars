import SwiftUI
import UIKit

struct DayCardStyleColor: Codable, Equatable {
    var red: Double
    var green: Double
    var blue: Double
    var opacity: Double

    init(red: Double, green: Double, blue: Double, opacity: Double = 1.0) {
        self.red = Self.clamp(red)
        self.green = Self.clamp(green)
        self.blue = Self.clamp(blue)
        self.opacity = Self.clamp(opacity)
    }

    init(_ color: Color) {
        let uiColor = UIColor(color)
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        uiColor.getRed(&red, green: &green, blue: &blue, alpha: &alpha)

        self.red = Double(red)
        self.green = Double(green)
        self.blue = Double(blue)
        self.opacity = Double(alpha)
    }

    var color: Color {
        Color(red: red, green: green, blue: blue, opacity: opacity)
    }

    private static func clamp(_ value: Double) -> Double {
        Swift.max(0, Swift.min(1, value))
    }
}

struct DayCardVisualStyle: Codable, Equatable {
    var cardCornerRadius: Double
    var cardPadding: Double
    var rowSpacing: Double
    var rowTitleSpacing: Double
    var dayCardGap: Double

    var titleFontScale: Double
    var subtitleFontScale: Double
    var trailingFontScale: Double

    var leadingAccessorySize: Double
    var leadingIconSize: Double

    var shellBackgroundOpacity: Double
    var shellContentOpacityMultiplier: Double
    var cardBackgroundAboveLine: DayCardStyleColor = DayCardStyleColor(S2.MyDay.DayCardStyleTokens.completedCardBackground)
    var cardBackgroundBelowLine: DayCardStyleColor = DayCardStyleColor(S2.MyDay.DayCardStyleTokens.plannedCardBackground)
    var dayViewBackground: DayCardStyleColor = DayCardStyleColor(S2.MyDay.DayCardStyleTokens.dayViewBackground)

    var hasShadow: Bool
    var shadowColor: DayCardStyleColor
    var shadowRadius: Double
    var shadowX: Double
    var shadowY: Double

    var hasBorder: Bool
    var borderColor: DayCardStyleColor
    var borderWidth: Double

    static let defaultStyle = S2.MyDay.DayCardStyleTokens.visualStyle

    func clamped() -> DayCardVisualStyle {
        var style = self

        style.cardCornerRadius = Self.clamp(cardCornerRadius, min: 0, max: 80)
        style.cardPadding = Self.clamp(cardPadding, min: 4, max: 40)
        style.rowSpacing = Self.clamp(rowSpacing, min: 0, max: 40)
        style.rowTitleSpacing = Self.clamp(rowTitleSpacing, min: 0, max: 28)
        style.dayCardGap = Self.clamp(dayCardGap, min: 0, max: 40)

        style.titleFontScale = Self.clamp(titleFontScale, min: 0.7, max: 1.6)
        style.subtitleFontScale = Self.clamp(subtitleFontScale, min: 0.7, max: 1.6)
        style.trailingFontScale = Self.clamp(trailingFontScale, min: 0.7, max: 1.6)

        style.leadingAccessorySize = Self.clamp(leadingAccessorySize, min: 12, max: 48)
        style.leadingIconSize = Self.clamp(leadingIconSize, min: 10, max: 40)

        style.shellBackgroundOpacity = Self.clamp(shellBackgroundOpacity, min: 0.2, max: 1.0)
        style.shellContentOpacityMultiplier = Self.clamp(shellContentOpacityMultiplier, min: 0.2, max: 1.5)

        style.shadowRadius = Self.clamp(shadowRadius, min: 0, max: 36)
        style.shadowX = Self.clamp(shadowX, min: -20, max: 20)
        style.shadowY = Self.clamp(shadowY, min: -20, max: 20)

        style.borderWidth = Self.clamp(borderWidth, min: 0, max: 5)

        return style
    }

    private static func clamp(_ value: Double, min: Double, max: Double) -> Double {
        let finiteValue = value.isFinite ? value : min
        return Swift.max(min, Swift.min(max, finiteValue))
    }
}

private struct DayCardVisualStyleKey: EnvironmentKey {
    static let defaultValue: DayCardVisualStyle = DayCardVisualStyle.defaultStyle
}

private struct DayCardSectionBackgroundKey: EnvironmentKey {
    static let defaultValue: DayCardStyleColor? = nil
}

extension EnvironmentValues {
    var dayCardVisualStyle: DayCardVisualStyle {
        get { self[DayCardVisualStyleKey.self] }
        set { self[DayCardVisualStyleKey.self] = newValue }
    }

    var dayCardSectionBackground: DayCardStyleColor? {
        get { self[DayCardSectionBackgroundKey.self] }
        set { self[DayCardSectionBackgroundKey.self] = newValue }
    }
}
