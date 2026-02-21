//
//  CoreBlockView.swift
//  Pillars
//
//  Lightweight base row shell for Day blocks.
//

import SwiftUI

struct CoreBlockView<Leading: View, Title: View, Subtitle: View, Trailing: View>: View {
    let onDelete: () -> Void
    let onTap: () -> Void
    private let leading: Leading
    private let title: Title
    private let subtitle: Subtitle
    private let trailing: Trailing

    init(
        onDelete: @escaping () -> Void,
        onTap: @escaping () -> Void,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder title: () -> Title,
        @ViewBuilder subtitle: () -> Subtitle = { EmptyView() },
        @ViewBuilder trailing: () -> Trailing = { EmptyView() }
    ) {
        self.onDelete = onDelete
        self.onTap = onTap
        self.leading = leading()
        self.title = title()
        self.subtitle = subtitle()
        self.trailing = trailing()
    }

    var body: some View {
        ListRow(swipeDelete: onDelete) {
            leading
        } title: {
            title
        } subtitle: {
            subtitle
        } trailing: {
            trailing
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
    }
}
