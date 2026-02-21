import SwiftUI

extension S2.MyDay {
    enum DayCardStyleTokens {
        // Core card colors
        static let dayViewBackground: Color = S2.Colors.background
        static let completedCardBackground: Color = S2.MyDay.Colors.sectionBackground
        static let plannedCardBackground: Color = S2.Colors.surface

        // Card geometry
        static let cardCornerRadius: CGFloat = 22
        static let completedItemCornerRadius: CGFloat = cardCornerRadius
        static let cardPadding: CGFloat = S2.MyDay.Spacing.coreBlockPadding
        static let rowSpacing: CGFloat = S2.MyDay.Spacing.blockHeader
        static let rowTitleSpacing: CGFloat = S2.MyDay.Spacing.compact
        static let dayCardGap: CGFloat = S2.MyDay.Spacing.dayCardGap

        // Typography
        static let titleFontScale: Double = 1.0
        static let subtitleFontScale: Double = 1.0
        static let trailingFontScale: Double = 1.0

        // Accessory and icon sizes
        static let leadingAccessorySize: CGFloat = 20
        static let leadingIconSize: CGFloat = 16
        static let doneButtonSize: CGFloat = 40
        static let doneButtonIconSize: CGFloat = 14

        // Shell
        static let shellBackgroundOpacity: Double = 1.0
        static let shellContentOpacityMultiplier: Double = 1.0

        // Shadow and border
        static let hasShadow: Bool = true
        static let shadowColor: Color = Color.black.opacity(0.03)
        static let shadowRadius: Double = 5
        static let shadowX: Double = 0
        static let shadowY: Double = 2
        static let hasBorder: Bool = true
        static let borderColor: Color = Color.black.opacity(0.04)
        static let borderWidth: Double = 1.0

        // Canonical visual style for Day cards.
        static let visualStyle: DayCardVisualStyle = DayCardVisualStyle(
            cardCornerRadius: Double(cardCornerRadius),
            cardPadding: Double(cardPadding),
            rowSpacing: Double(rowSpacing),
            rowTitleSpacing: Double(rowTitleSpacing),
            dayCardGap: Double(dayCardGap),

            titleFontScale: titleFontScale,
            subtitleFontScale: subtitleFontScale,
            trailingFontScale: trailingFontScale,

            leadingAccessorySize: Double(leadingAccessorySize),
            leadingIconSize: Double(leadingIconSize),

            shellBackgroundOpacity: shellBackgroundOpacity,
            shellContentOpacityMultiplier: shellContentOpacityMultiplier,
            cardBackgroundAboveLine: DayCardStyleColor(completedCardBackground),
            cardBackgroundBelowLine: DayCardStyleColor(plannedCardBackground),
            dayViewBackground: DayCardStyleColor(dayViewBackground),

            hasShadow: hasShadow,
            shadowColor: DayCardStyleColor(shadowColor),
            shadowRadius: shadowRadius,
            shadowX: shadowX,
            shadowY: shadowY,

            hasBorder: hasBorder,
            borderColor: DayCardStyleColor(borderColor),
            borderWidth: borderWidth
        )
    }
}
