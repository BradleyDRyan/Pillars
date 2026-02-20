//
//  ListRow.swift
//  Pillars
//
//  Reusable native-style list row for shared row layout across tabs.
//

import SwiftUI

struct ListRow: View {
    private let showDivider: Bool
    private let allowsFullSwipeDelete: Bool
    private let swipeDelete: (() -> Void)?
    private let horizontalPadding: CGFloat
    private let verticalPadding: CGFloat
    private let leadingTitleSpacing: CGFloat
    private let titleSubtitleSpacing: CGFloat
    private let leading: AnyView
    private let title: AnyView
    private let subtitle: AnyView
    private let trailing: AnyView

    init<Leading: View, Title: View, Subtitle: View, Trailing: View>(
        showDivider: Bool = true,
        allowsFullSwipeDelete: Bool = true,
        swipeDelete: (() -> Void)? = nil,
        horizontalPadding: CGFloat = S2.MyDay.Spacing.rowHorizontal,
        verticalPadding: CGFloat = S2.MyDay.Spacing.rowVertical,
        leadingTitleSpacing: CGFloat = S2.MyDay.Spacing.iconTitleGap,
        titleSubtitleSpacing: CGFloat = S2.MyDay.Spacing.compact,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder title: () -> Title,
        @ViewBuilder subtitle: () -> Subtitle = { EmptyView() },
        @ViewBuilder trailing: () -> Trailing = { EmptyView() }
    ) {
        self.showDivider = showDivider
        self.allowsFullSwipeDelete = allowsFullSwipeDelete
        self.swipeDelete = swipeDelete
        self.horizontalPadding = horizontalPadding
        self.verticalPadding = verticalPadding
        self.leadingTitleSpacing = leadingTitleSpacing
        self.titleSubtitleSpacing = titleSubtitleSpacing
        self.leading = AnyView(leading())
        self.title = AnyView(title())
        self.subtitle = AnyView(subtitle())
        self.trailing = AnyView(trailing())
    }

    var body: some View {
        if let swipeDelete {
            rowBody
                .swipeActions(edge: .trailing, allowsFullSwipe: allowsFullSwipeDelete) {
                    Button(role: .destructive, action: swipeDelete) {
                        Label("Delete", systemImage: "trash")
                    }
                }
        } else {
            rowBody
        }
    }

    @ViewBuilder
    private var rowBody: some View {
        VStack(spacing: 0) {
            LabeledContent {
                trailing
            } label: {
                HStack(spacing: leadingTitleSpacing) {
                    leading

                    VStack(alignment: .leading, spacing: titleSubtitleSpacing) {
                        title
                        subtitle
                    }
                }
            }
            .padding(.horizontal, horizontalPadding)
            .padding(.vertical, verticalPadding)

            if showDivider {
                Divider()
                    .overlay(S2.MyDay.Colors.divider)
                    .padding(.horizontal, horizontalPadding)
            }
        }
    }
}
