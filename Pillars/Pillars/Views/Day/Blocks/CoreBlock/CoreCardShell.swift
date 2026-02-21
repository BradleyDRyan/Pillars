//
//  CoreCardShell.swift
//  Pillars
//
//  Shared card shell for Day row and stack cards.
//

import SwiftUI

struct CoreCardShell<Content: View>: View {
    let onDelete: (() -> Void)?
    let onTap: (() -> Void)?
    let backgroundOpacity: Double
    let contentOpacity: Double
    let hasShadow: Bool?
    let shadowOpacityMultiplier: Double
    private let content: Content

    init(
        onDelete: (() -> Void)? = nil,
        onTap: (() -> Void)? = nil,
        backgroundOpacity: Double = 1.0,
        contentOpacity: Double = 1.0,
        hasShadow: Bool? = nil,
        shadowOpacityMultiplier: Double = 1.0,
        @ViewBuilder content: () -> Content
    ) {
        self.onDelete = onDelete
        self.onTap = onTap
        self.backgroundOpacity = backgroundOpacity
        self.contentOpacity = contentOpacity
        self.hasShadow = hasShadow
        self.shadowOpacityMultiplier = shadowOpacityMultiplier
        self.content = content()
    }

    @Environment(\.dayCardVisualStyle) private var style
    @Environment(\.dayCardSectionBackground) private var sectionBackground

    var body: some View {
        let resolvedHasShadow = hasShadow ?? style.hasShadow
        let shellCornerRadius = CGFloat(style.cardCornerRadius)
        let borderWidth = CGFloat(style.borderWidth)
        let borderColor = style.hasBorder ? style.borderColor.color : .clear
        let sectionColor = sectionBackground?.color ?? style.cardBackgroundAboveLine.color
        let backgroundOpacityTotal = backgroundOpacity * style.shellBackgroundOpacity
        let contentOpacityTotal = contentOpacity * style.shellContentOpacityMultiplier

        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: shellCornerRadius, style: .continuous)
                .fill(sectionColor.opacity(backgroundOpacityTotal))
                .overlay(
                    RoundedRectangle(cornerRadius: shellCornerRadius, style: .continuous)
                        .stroke(borderColor, lineWidth: borderWidth)
                )

            content
                .opacity(contentOpacityTotal)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .clipShape(RoundedRectangle(cornerRadius: shellCornerRadius, style: .continuous))
        .modifier(
            CoreCardShellShadowModifier(
                enabled: resolvedHasShadow,
                opacityMultiplier: shadowOpacityMultiplier,
                style: style
            )
        )
        .modifier(CoreCardShellTapContextModifier(onTap: onTap, onDelete: onDelete))
    }
}

private struct CoreCardShellTapContextModifier: ViewModifier {
    let onTap: (() -> Void)?
    let onDelete: (() -> Void)?

    @ViewBuilder
    func body(content: Content) -> some View {
        if let onTap, let onDelete {
            content
                .onTapGesture {
                    onTap()
                }
                .contextMenu {
                    Button(role: .destructive) {
                        onDelete()
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
        } else if let onTap {
            content
                .onTapGesture {
                    onTap()
                }
        } else if let onDelete {
            content
                .contextMenu {
                    Button(role: .destructive) {
                        onDelete()
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
        } else {
            content
        }
    }
}

private struct CoreCardShellShadowModifier: ViewModifier {
    let enabled: Bool
    let opacityMultiplier: Double
    let style: DayCardVisualStyle

    @ViewBuilder
    func body(content: Content) -> some View {
        if enabled {
            let clampedOpacity = min(1.0, max(0.0, opacityMultiplier))
            let shadowColor = style.shadowColor.color.opacity(clampedOpacity)
            content.shadow(
                color: shadowColor,
                radius: CGFloat(style.shadowRadius),
                x: CGFloat(style.shadowX),
                y: CGFloat(style.shadowY)
            )
        } else {
            content
        }
    }
}
