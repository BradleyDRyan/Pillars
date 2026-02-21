//
//  HabitBlock.swift
//  Pillars
//
//  Day surface row for projected habit blocks with inline completion toggle.
//

import SwiftUI

struct HabitBlock: View {
    @Binding var block: Block
    let customTypes: [BlockType]
    let onDelete: () -> Void
    let titleOverride: String?
    let trailingOverride: String?
    let pillarTag: BlockPillarTagDisplay?
    let onPillarTap: (() -> Void)?
    let onToggleCompletion: () -> Void
    let onSkipHabit: () -> Void
    let onUnskipHabit: () -> Void

    private var isCompleted: Bool {
        block.checklistData?.items.first?.isCompleted ?? false
    }

    private var habitStatus: HabitLogStatus {
        guard let status = block.data["status"]?.stringValue else {
            return isCompleted ? .completed : .pending
        }
        return HabitLogStatus(rawValue: status.lowercased()) ?? (isCompleted ? .completed : .pending)
    }

    private var isSkipped: Bool {
        habitStatus == .skipped
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
            pillarTag: pillarTag,
            onPillarTap: onPillarTap,
            showLeadingAccessory: false
        )
        .contextMenu {
            Button {
                if isSkipped {
                    onUnskipHabit()
                } else {
                    onSkipHabit()
                }
            } label: {
                Label(isSkipped ? "Unskip" : "Skip today", systemImage: isSkipped ? "arrow.uturn.left" : "slash.circle")
            }

            Button(role: .destructive) {
                onDelete()
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }
}
