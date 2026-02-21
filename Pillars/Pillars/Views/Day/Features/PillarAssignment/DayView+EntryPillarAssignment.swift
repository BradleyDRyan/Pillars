import SwiftUI

// Pillar tagging actions for Day entries.
// Handles displaying the pillar chip text and writing the chosen pillar.
extension DayView {
    // Builds the small pillar label shown in entry rows.
    func pillarTag(for block: Block) -> BlockPillarTagDisplay {
        if let pillar = pillarPickerSource.pillar(for: block.pillarId) {
            return BlockPillarTagDisplay(title: pillar.name, color: pillar.colorValue)
        }
        if block.pillarId != nil {
            return BlockPillarTagDisplay(
                title: "Tagged",
                color: S2.Semantics.onSurfaceSecondary
            )
        }
        return BlockPillarTagDisplay(
            title: "No Pillar",
            color: S2.Semantics.onSurfaceSecondary
        )
    }

    // Opens the pillar picker and remembers which item should be tagged.
    func presentPillarPicker(for section: DaySection.TimeSection, blockId: String) {
        guard let block = blockValue(for: blockId, in: section) else { return }

        // If this row represents a todo, save the pillar on that todo.
        if let todoId = viewModel.projectedTodoId(for: block) {
            pillarPickerTarget = PillarPickerTarget(
                id: "todo:\(todoId)",
                currentPillarId: block.pillarId,
                kind: .todo(todoId: todoId)
            )
            return
        }

        // If this row represents a habit, save the pillar on that habit.
        if let habitId = viewModel.projectedHabitId(for: block) {
            pillarPickerTarget = PillarPickerTarget(
                id: "habit:\(habitId)",
                currentPillarId: block.pillarId,
                kind: .habit(habitId: habitId)
            )
            return
        }

        // Otherwise, save the pillar on the day block itself.
        pillarPickerTarget = PillarPickerTarget(
            id: "day:\(section.rawValue):\(blockId)",
            currentPillarId: block.pillarId,
            kind: .dayBlock(section: section, blockId: blockId)
        )
    }

    // Applies the selected pillar to the right destination.
    func applyPillarSelection(_ pillarId: String?, for target: PillarPickerTarget) {
        switch target.kind {
        case .todo(let todoId):
            viewModel.setTodoPillar(todoId: todoId, pillarId: pillarId)
        case .habit(let habitId):
            viewModel.setHabitPillar(habitId: habitId, pillarId: pillarId)
        case .dayBlock(let section, let blockId):
            viewModel.setDayBlockPillar(blockId: blockId, section: section, pillarId: pillarId)
        }
    }
}
