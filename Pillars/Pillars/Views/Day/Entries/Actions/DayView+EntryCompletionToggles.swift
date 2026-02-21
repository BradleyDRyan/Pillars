import SwiftUI

// Completion actions used by entry rows.
// These functions handle quick toggles directly from the Day list.
extension DayView {
    // Toggles the first todo item for the entry row.
    func toggleTodoCompletion(blockId: String, in section: DaySection.TimeSection) {
        guard var block = blockValue(for: blockId, in: section) else { return }
        guard var items = block.checklistData?.items else { return }
        guard !items.isEmpty else { return }

        withAnimation(dayEntryTransferAnimation) {
            items[0].isCompleted.toggle()
            block.checklistData = ChecklistData(items: items)
            viewModel.updateBlock(block, in: section)
        }
    }

    // Toggles completion for habit rows.
    func toggleHabitCompletion(blockId: String, in section: DaySection.TimeSection) {
        guard var block = blockValue(for: blockId, in: section) else { return }
        guard var items = block.checklistData?.items else { return }
        guard !items.isEmpty else { return }

        withAnimation(dayEntryTransferAnimation) {
            items[0].isCompleted.toggle()
            block.checklistData = ChecklistData(items: [items[0]])
            viewModel.updateBlock(block, in: section)
        }
    }
}
