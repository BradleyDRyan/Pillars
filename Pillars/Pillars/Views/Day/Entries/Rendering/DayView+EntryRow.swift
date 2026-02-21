import SwiftUI

// Row-level rendering for each Day entry.
// This file chooses which block view to show based on block type.
extension DayView {
    // Returns the right row component for one entry.
    @ViewBuilder
    func dayEntryRow(for entry: DayEntry) -> some View {
        if let blockBinding = blockBinding(for: entry.blockId, in: entry.section) {
            let normalizedType = blockBinding.wrappedValue.typeId.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

            // Todo row.
            if normalizedType == "todo" || normalizedType == "todos" {
                TodoBlockView(
                    block: blockBinding,
                    customTypes: viewModel.customBlockTypes,
                    onDelete: {
                        viewModel.deleteBlock(entry.blockId, from: entry.section)
                    },
                    titleOverride: entry.title,
                    trailingOverride: entry.trailing,
                    pillarTag: pillarTag(for: blockBinding.wrappedValue),
                    onPillarTap: {
                        presentPillarPicker(for: entry.section, blockId: entry.blockId)
                    },
                    onToggleCompletion: {
                        toggleTodoCompletion(blockId: entry.blockId, in: entry.section)
                    }
                )
            // Habit stack row.
            } else if normalizedType == "habit-stack" {
                let stackItems = habitStackItems(for: blockBinding.wrappedValue)
                HabitStackCard(
                    title: entry.title,
                    summary: entry.trailing,
                    items: stackItems,
                    onToggleHabit: { habitId, isCompleted in
                        withAnimation(dayEntryTransferAnimation) {
                            viewModel.setHabitCompletion(
                                habitId: habitId,
                                isCompleted: isCompleted
                            )
                        }
                    }
                )
            // Habit row.
            } else if normalizedType == "habits" || normalizedType == "morninghabits" {
                HabitBlock(
                    block: blockBinding,
                    customTypes: viewModel.customBlockTypes,
                    onDelete: {
                        viewModel.deleteBlock(entry.blockId, from: entry.section)
                    },
                    titleOverride: entry.title,
                    trailingOverride: entry.trailing,
                    pillarTag: pillarTag(for: blockBinding.wrappedValue),
                    onPillarTap: {
                        presentPillarPicker(for: entry.section, blockId: entry.blockId)
                    },
                    onToggleCompletion: {
                        toggleHabitCompletion(blockId: entry.blockId, in: entry.section)
                    },
                    onSkipHabit: {
                        guard let habitId = viewModel.projectedHabitId(for: blockBinding.wrappedValue) else { return }
                        viewModel.skipHabit(habitId: habitId)
                    },
                    onUnskipHabit: {
                        guard let habitId = viewModel.projectedHabitId(for: blockBinding.wrappedValue) else { return }
                        viewModel.markHabitPending(habitId: habitId)
                    }
                )
            // Fallback row for all other block types.
            } else {
                DefaultBlockView(
                    block: blockBinding,
                    customTypes: viewModel.customBlockTypes,
                    onDelete: {
                        viewModel.deleteBlock(entry.blockId, from: entry.section)
                    },
                    titleOverride: entry.title,
                    trailingOverride: entry.trailing,
                    pillarTag: pillarTag(for: blockBinding.wrappedValue),
                    onPillarTap: {
                        presentPillarPicker(for: entry.section, blockId: entry.blockId)
                    }
                )
            }
        }
    }

}
