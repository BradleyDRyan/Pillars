import SwiftUI

// Summary text for habit and habit-stack entries.
extension DayView {
    // Builds display text for habit checklist rows.
    func habitSummary(_ data: ChecklistData?) -> DayEntrySummary {
        let items = data?.items ?? []
        let total = items.count
        let completed = items.filter(\.isCompleted).count

        guard total > 0 else {
            return DayEntrySummary(title: "Add habit", trailing: nil, isLogged: false)
        }

        if total == 1 {
            let primaryTitle = items[0].title.trimmingCharacters(in: .whitespacesAndNewlines)
            let displayTitle = primaryTitle.isEmpty ? "Habit" : primaryTitle
            return DayEntrySummary(
                title: displayTitle,
                trailing: nil,
                isLogged: items[0].isCompleted
            )
        }

        if completed > 0 {
            return DayEntrySummary(
                title: "Completed \(completed)/\(total) morning habits",
                trailing: nil,
                isLogged: true
            )
        }

        return DayEntrySummary(
            title: "Morning habits planned",
            trailing: "\(total) items",
            isLogged: false
        )
    }

    // Builds display text for habit stack rows.
    func habitStackSummary(_ block: Block, items: [DayViewModel.HabitStackItem]? = nil) -> DayEntrySummary {
        let items = items ?? viewModel.habitStackItems(for: block)
        let total = items.count
        let completed = items.filter(\.isCompleted).count
        let stackTitle = {
            if let groupName = block.data["groupName"]?.stringValue?
                .trimmingCharacters(in: .whitespacesAndNewlines),
               !groupName.isEmpty {
                return groupName
            }

            let trimmedTitle = block.title?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return trimmedTitle.isEmpty ? "Habit Stack" : trimmedTitle
        }()

        guard total > 0 else {
            return DayEntrySummary(title: "Habit stack", trailing: nil, isLogged: false)
        }

        let firstHabitTitle = items.first?.name.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let displayTitle = total == 1
            ? (firstHabitTitle.isEmpty ? "Habit" : firstHabitTitle)
            : stackTitle

        return DayEntrySummary(
            title: displayTitle,
            trailing: "\(completed)/\(total)",
            isLogged: completed == total
        )
    }

    // Pulls all habit items for a habit-stack row.
    func habitStackItems(for block: Block) -> [DayViewModel.HabitStackItem] {
        viewModel.habitStackItems(for: block)
    }

    // Simple type check used by the entry builder.
    func isHabitStackBlock(_ block: Block) -> Bool {
        block.typeId.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "habit-stack"
    }
}
