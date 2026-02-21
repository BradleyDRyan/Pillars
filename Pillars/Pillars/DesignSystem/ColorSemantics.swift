import SwiftUI

extension S2 {
    enum Semantics {
        static var background: Color { Foundations.white }
        static var onBackgroundPrimary: Color { Foundations.black }
        static var onBackgroundSecondary: Color { Foundations.mediumGray }
        static var onBackgroundTertiary: Color { Foundations.lightTertiaryGray }

        static var surface: Color { Foundations.white }
        static var onSurfacePrimary: Color { Foundations.black }
        static var onSurfaceSecondary: Color { Foundations.mediumGray }
        static var onSurfaceTertiary: Color { Foundations.lightTertiaryGray }

        static var groupedBackground: Color { Foundations.lightGray }
        static var onGroupedBackgroundPrimary: Color { Foundations.black }
        static var onGroupedBackgroundSecondary: Color { Foundations.mediumGray }
        static var onGroupedBackgroundTertiary: Color { Foundations.lightTertiaryGray }

        static var primary: Color { Foundations.black }
        static var onPrimary: Color { Foundations.white }
        static var secondary: Color { Foundations.mediumGray }
        static var onSecondary: Color { Foundations.black }

        static var secondarySurface: Color { Color(hex: "F3F4F5") }
        static var secondaryText: Color { onSurfaceSecondary }
        static var tertiarySurface: Color { Color(hex: "F8F9FA") }
        static var elevated: Color { Foundations.white }
        static var tinted: Color { Color(hex: "F3F4F5") }

        static var primaryBrand: Color { primary }
        static var secondaryBrand: Color { Foundations.warmOrange }
        static var accentGreen: Color { Foundations.accentGreen }
        static var error: Color { Color(lightMode: Foundations.errorLight, darkMode: Foundations.errorDark) }

        static var backgroundGrouped: Color { groupedBackground }
    }
}
