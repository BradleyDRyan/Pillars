import SwiftUI

// Gets a block from the day and, when needed, lets the row update it.
// In short: read block data or edit block data.
extension DayView {
    // Gives a row direct edit access to one block.
    // Returns nil if that block cannot be found.
    func blockBinding(for blockId: String, in section: DaySection.TimeSection) -> Binding<Block>? {
        guard let day = viewModel.day,
              let sectionIndex = day.sections.firstIndex(where: { $0.id == section }),
              let blockIndex = day.sections[sectionIndex].blocks.firstIndex(where: { $0.id == blockId }) else {
            return nil
        }

        let fallback = day.sections[sectionIndex].blocks[blockIndex]

        return Binding(
            get: {
                guard let currentDay = viewModel.day,
                      let currentSectionIndex = currentDay.sections.firstIndex(where: { $0.id == section }),
                      let currentBlockIndex = currentDay.sections[currentSectionIndex].blocks.firstIndex(where: { $0.id == blockId }) else {
                    return fallback
                }
                return currentDay.sections[currentSectionIndex].blocks[currentBlockIndex]
            },
            set: { updated in
                viewModel.updateBlock(updated, in: section)
            }
        )
    }

    // Gets the current block value when we only need to read it.
    func blockValue(for blockId: String, in section: DaySection.TimeSection) -> Block? {
        guard let day = viewModel.day,
              let sectionIndex = day.sections.firstIndex(where: { $0.id == section }),
              let block = day.sections[sectionIndex].blocks.first(where: { $0.id == blockId }) else {
            return nil
        }
        return block
    }
}
