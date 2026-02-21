//
//  MyDayDesignSystem.swift
//  Pillars
//
//  My Day specific design primitives and reusable components
//

import SwiftUI
import UIKit

extension S2 {
    enum MyDay {
        enum Spacing {
            // Master spacing knob (default). Compact mode can set this to 1.5.
            static var spacing2: CGFloat = 2

            // Interval scale. i(1) is the smallest step, i(2) equals spacing2.
            static func i(_ interval: CGFloat) -> CGFloat {
                (spacing2 / 2) * interval
            }

            static var pageHorizontal: CGFloat { i(16) }
            static var pageVertical: CGFloat { i(10) }
            static var spacing20: CGFloat { i(20) }
            static var sectionStack: CGFloat { i(12) }
            static var sectionGap: CGFloat { i(24) }
            static var sectionContent: CGFloat { i(8) }
            static var sectionHeader: CGFloat { i(6) }
            static var iconTitleGap: CGFloat { i(12) }
            static var blockStack: CGFloat { i(2) }
            static var blockHeader: CGFloat { i(8) }
            static var dayCardGap: CGFloat { i(16) }
            static var blockBody: CGFloat { i(12) }
            static var coreBlockPadding: CGFloat { i(16) }
            static var contentStack: CGFloat { i(14) }
            static var fieldStack: CGFloat { i(6) }
            static var compact: CGFloat { i(2) }
            static var cardPadding: CGFloat { i(12) }
            static var blockPadding: CGFloat { i(12) }
            static var inputPadding: CGFloat { i(10) }
            static var inputInset: CGFloat { i(6) }
            static var rowVertical: CGFloat { i(12) }
            static var rowHorizontal: CGFloat { i(4) }
            static var rowMinGap: CGFloat { i(6) }
            static var emptyStateVertical: CGFloat { i(2) }
            static var errorPadding: CGFloat { i(24) }
        }

        enum CornerRadius {
            static let section = S2.CornerRadius.lg
            static let card = S2.CornerRadius.md
            static let block: CGFloat = 18
            static let icon = S2.CornerRadius.sm
            static let input = S2.CornerRadius.sm
            static let row = S2.CornerRadius.sm
        }

        enum Icon {
            static let badgeSize: CGFloat = 30
            static let primarySize: CGFloat = 18
            static let smallSize: CGFloat = 16
            static let actionSize: CGFloat = 13
            static let checklistSize: CGFloat = 22
            static let ratingSize: CGFloat = 22
            static let stepperSize: CGFloat = 28
            static let doneButtonSize: CGFloat = 40
            static let doneButtonIconSize: CGFloat = 13
            static let doneButtonIconSizeRegular: CGFloat = 14
            static let habitGroupProgressSize: CGFloat = 32
            static let habitGroupProgressIconSize: CGFloat = 12
        }

        enum Typography {
            // Apple-native text style names
            static let largeTitle = S2.TextStyle.largeTitle
            static let title = S2.TextStyle.title
            static let title2 = S2.TextStyle.title2
            static let title3 = S2.TextStyle.title3
            static let headline = S2.TextStyle.headline
            static let body = S2.TextStyle.body
            static let callout = S2.TextStyle.callout
            static let subheadline = S2.TextStyle.subheadline
            static let footnote = S2.TextStyle.footnote
            static let caption = S2.TextStyle.caption
            static let caption2 = S2.TextStyle.caption2

            // Feature-specific roles mapped to native style names
            static let dateTitle = title2
            static let dateSubtitle = subheadline
            static let sectionTitle = headline
            static let sectionAction = footnote
            static let sectionLabel = headline
            static let blockTitle = callout
            static let blockSubtitle = caption
            static let fieldLabel = caption
            static let fieldValue = subheadline
            static let helper = footnote
            static let valueStrong = callout
            static let emptyState = subheadline
            static let deleteAction = footnote
        }

        enum Colors {
            static let pageBackground = S2.Colors.groupedBackground
            static let sectionBackground = S2.Colors.surface
            static let blockBackground = S2.Colors.secondary
            static let inputBackground = S2.Colors.surface
            static let titleText = S2.Colors.onSurfacePrimary
            static let subtitleText = S2.Colors.onSurfaceSecondary
            static let placeholderText = S2.Colors.onSurfaceTertiary
            static let interactiveTint = Color.accentColor
            static let iconTint = Color.accentColor
            static let rowIconTint = S2.Colors.secondaryBrand
            static let iconBackground = S2.Colors.secondary.opacity(0.12)
            static let divider = S2.Colors.secondaryText.opacity(0.2)
            static let destructive = S2.Colors.error
            static let ratingFilled = Color(hex: "F8B941")
            static let ratingEmpty = S2.Colors.onSurfaceTertiary.opacity(0.45)
            static let disabledIcon = S2.Colors.onSurfaceTertiary.opacity(0.45)
            static let sectionShadowColor = Color.black.opacity(0.04)
        }
    }
}

struct S2MyDayIconBadge: View {
    let systemName: String
    let size: CGFloat
    let iconFontSize: CGFloat

    init(
        systemName: String,
        size: CGFloat = S2.MyDay.Icon.badgeSize,
        iconFontSize: CGFloat = S2.MyDay.Icon.smallSize
    ) {
        self.systemName = systemName
        self.size = size
        self.iconFontSize = iconFontSize
    }

    var body: some View {
        Image(systemName: systemName)
            .font(.system(size: iconFontSize, weight: .semibold))
            .foregroundColor(S2.MyDay.Colors.iconTint)
            .frame(width: size, height: size)
            .background(S2.MyDay.Colors.iconBackground)
            .clipShape(RoundedRectangle(cornerRadius: S2.MyDay.CornerRadius.icon, style: .continuous))
    }
}

struct S2MyDayFieldLabel: View {
    let text: String

    var body: some View {
        Text(text)
            .font(S2.MyDay.Typography.fieldLabel)
            .foregroundColor(S2.MyDay.Colors.subtitleText)
    }
}

struct S2MyDayDoneButton: View {
        enum Size {
            case compact
            case regular

            var buttonSize: CGFloat {
                switch self {
                case .compact:
                    return S2.MyDay.Icon.doneButtonSize
                case .regular:
                    return S2.MyDay.Icon.doneButtonSize
                }
            }

            var iconSize: CGFloat {
                switch self {
                case .compact:
                    return S2.MyDay.Icon.doneButtonIconSize
                case .regular:
                    return S2.MyDay.Icon.doneButtonIconSizeRegular
                }
            }
        }

    let isCompleted: Bool
    let size: Size
    let completedIconName: String
    let incompleteIconName: String
    let action: () -> Void

    init(
        isCompleted: Bool,
        size: Size = .compact,
        completedIconName: String = "checkmark",
        incompleteIconName: String = "checkmark",
        action: @escaping () -> Void
    ) {
        self.isCompleted = isCompleted
        self.size = size
        self.completedIconName = completedIconName
        self.incompleteIconName = incompleteIconName
        self.action = action
    }

    var body: some View {
        S2MyDayDoneIconButton(
            isCompleted: isCompleted,
            size: size,
            completedIconName: completedIconName,
            incompleteIconName: incompleteIconName,
            action: action
        )
    }
}

struct S2MyDayDoneIconButton: View {
    let isCompleted: Bool
    let size: S2MyDayDoneButton.Size
    let completedIconName: String
    let incompleteIconName: String
    let action: () -> Void
    @State private var pressScale: CGFloat = 1.0
    @GestureState private var isPressing: Bool = false

    init(
        isCompleted: Bool,
        size: S2MyDayDoneButton.Size = .compact,
        completedIconName: String = "checkmark",
        incompleteIconName: String = "checkmark",
        action: @escaping () -> Void
    ) {
        self.isCompleted = isCompleted
        self.size = size
        self.completedIconName = completedIconName
        self.incompleteIconName = incompleteIconName
        self.action = action
    }

    private var iconName: String {
        isCompleted ? completedIconName : incompleteIconName
    }

    private var iconButtonScale: CGFloat {
        min(size.buttonSize / 44, 1.0)
    }

    private var completedPressScale: CGFloat {
        let pressInScale: CGFloat = isPressing ? 0.82 : 1.0
        return pressScale * pressInScale * iconButtonScale
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(S2.Colors.secondarySurface)
                .frame(width: S2.MyDay.Icon.doneButtonSize, height: S2.MyDay.Icon.doneButtonSize)

            Image(systemName: iconName)
                .font(.system(size: size == .compact ? S2.MyDay.Icon.doneButtonIconSize : S2.MyDay.Icon.doneButtonIconSizeRegular, weight: .semibold))
                .foregroundColor(.primary)
                .frame(width: S2.MyDay.Icon.doneButtonSize, height: S2.MyDay.Icon.doneButtonSize)
                .contentShape(Circle())
                .gesture(
                    LongPressGesture(minimumDuration: 0, maximumDistance: 12)
                        .updating($isPressing) { value, state, _ in
                            state = value
                        }
                        .onEnded { _ in
                            let impact = UIImpactFeedbackGenerator(style: .soft)
                            impact.prepare()
                            impact.impactOccurred()
                            animatePress()
                            action()
                        }
                )
                .animation(.easeOut(duration: 0.08), value: isPressing)
        }
        .scaleEffect(completedPressScale)
        .frame(width: S2.MyDay.Icon.doneButtonSize, height: S2.MyDay.Icon.doneButtonSize)
    }

    private func animatePress() {
        withAnimation(.easeOut(duration: 0.08)) {
            pressScale = 0.85
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
            withAnimation(.spring(response: 0.42, dampingFraction: 0.98)) {
                pressScale = 1.0
            }
        }
    }
}

extension View {
    func s2MyDaySectionCard() -> some View {
        self
            .padding(S2.MyDay.Spacing.cardPadding)
            .background(S2.MyDay.Colors.sectionBackground)
            .clipShape(RoundedRectangle(cornerRadius: S2.MyDay.CornerRadius.section, style: .continuous))
            .shadow(
                color: S2.MyDay.Colors.sectionShadowColor,
                radius: S2.Shadow.md.radius,
                x: S2.Shadow.md.x,
                y: S2.Shadow.md.y
            )
    }

    func s2MyDayBlockCard() -> some View {
        self
            .padding(S2.MyDay.Spacing.blockPadding)
            .background(S2.MyDay.Colors.blockBackground)
            .clipShape(RoundedRectangle(cornerRadius: S2.MyDay.CornerRadius.block, style: .continuous))
    }

    func s2MyDayInputSurface(padding: CGFloat = S2.MyDay.Spacing.inputPadding) -> some View {
        self
            .padding(padding)
            .background(S2.MyDay.Colors.inputBackground)
            .clipShape(RoundedRectangle(cornerRadius: S2.MyDay.CornerRadius.input, style: .continuous))
    }

    func s2MyDayListRowBackground() -> some View {
        self
            .background(
                RoundedRectangle(cornerRadius: S2.MyDay.CornerRadius.row, style: .continuous)
                    .fill(S2.MyDay.Colors.sectionBackground)
            )
    }
}
