//
//  CoreCardRow.swift
//  Pillars
//
//  Shared row composition for Day cards.
//

import SwiftUI

struct CoreCardRow<Leading: View, Title: View, Subtitle: View, Trailing: View>: View {
    private let leading: Leading
    private let title: Title
    private let subtitle: Subtitle
    private let trailing: Trailing
    @Environment(\.dayCardVisualStyle) private var style

    init(
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder title: () -> Title,
        @ViewBuilder subtitle: () -> Subtitle = { EmptyView() },
        @ViewBuilder trailing: () -> Trailing = { EmptyView() }
    ) {
        self.leading = leading()
        self.title = title()
        self.subtitle = subtitle()
        self.trailing = trailing()
    }

    var body: some View {
        HStack(alignment: .center, spacing: CGFloat(style.rowSpacing)) {
            leading

            VStack(alignment: .leading, spacing: CGFloat(style.rowTitleSpacing)) {
                title
                    .scaleEffect(CGFloat(style.titleFontScale))
                subtitle
                    .scaleEffect(CGFloat(style.subtitleFontScale))
            }

            Spacer(minLength: 0)

            trailing
                .scaleEffect(CGFloat(style.trailingFontScale))
        }
        .padding(CGFloat(style.cardPadding))
        .contentShape(Rectangle())
    }
}
