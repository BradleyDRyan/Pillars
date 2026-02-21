//
//  CoreBlock.swift
//  Pillars
//
//  Canonical alias-like shell for standard Day rows.
//

import SwiftUI

@available(*, deprecated, message: "Use CoreCardShell for shared card row rendering.")
struct CoreBlock<Leading: View, Title: View, Subtitle: View, Trailing: View>: View {
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
        CoreCardShell(onDelete: onDelete, onTap: onTap) {
            CoreCardRow(
                leading: { leading },
                title: { title },
                subtitle: { subtitle },
                trailing: { trailing }
            )
        }
    }
}
