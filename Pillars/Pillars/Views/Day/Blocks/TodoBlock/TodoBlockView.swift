//
//  TodoBlockView.swift
//  Pillars
//
//  Day surface row for projected todo blocks with inline completion toggle.
//

import SwiftUI

struct TodoBlockView: View {
    @Binding var block: Block
    let customTypes: [BlockType]
    let onDelete: () -> Void
    let titleOverride: String?
    let trailingOverride: String?
    let pillarTag: BlockPillarTagDisplay?
    let onPillarTap: (() -> Void)?
    let onToggleCompletion: () -> Void

    private var isCompleted: Bool {
        block.checklistData?.items.first?.isCompleted ?? false
    }

    private var bountyPointsText: String? {
        guard isCompleted else { return nil }
        guard let number = block.data["bountyPoints"]?.numberValue else { return nil }
        let points = Int(number)
        guard points > 0 else { return nil }
        return "+\(points)"
    }

    var body: some View {
        DefaultBlockView(
            block: $block,
            customTypes: customTypes,
            onDelete: onDelete,
            titleOverride: titleOverride,
            trailingOverride: trailingOverride,
            isCheckable: true,
            isChecked: isCompleted,
            onCheckToggle: onToggleCompletion,
            pillarTag: nil,
            onPillarTap: onPillarTap,
            showLeadingAccessory: false,
            compactCompletedStyle: true,
            compactCompletedTrailingText: bountyPointsText
        )
        .contextMenu {
            if isCompleted {
                Button("Mark incomplete") {
                    onToggleCompletion()
                }
            } else {
                Button("Mark complete") {
                    onToggleCompletion()
                }
            }
        }
    }
}
