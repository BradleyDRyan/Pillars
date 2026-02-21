import SwiftUI

// Summary text for workout, todo, and reflection entries.
extension DayView {
    // Builds display text for workout rows.
    func workoutSummary(_ data: TextFieldData?) -> DayEntrySummary {
        let type = textFieldValue(data, id: "type")
        let duration = textFieldValue(data, id: "duration")
        let notes = textFieldValue(data, id: "notes")
        let hasEntry = [type, duration, notes].contains(where: { $0 != nil })

        if let type {
            return DayEntrySummary(title: type, trailing: duration, isLogged: true)
        }

        if let notes {
            return DayEntrySummary(title: notes, trailing: duration, isLogged: true)
        }

        return DayEntrySummary(
            title: hasEntry ? "Workout logged" : "Plan workout",
            trailing: duration,
            isLogged: hasEntry
        )
    }

    // Builds display text for todo rows.
    func todoSummary(_ data: ChecklistData?) -> DayEntrySummary {
        let items = data?.items ?? []
        let titles = items
            .map(\.title)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        guard !titles.isEmpty else {
            return DayEntrySummary(title: "Add a to-do", trailing: nil, isLogged: false)
        }

        let completedCount = items.filter(\.isCompleted).count
        let totalCount = max(1, items.count)
        let isDone = completedCount == totalCount
        let extra = max(0, titles.count - 1)
        let suffix = extra > 0 ? " +\(extra)" : ""
        let baseTitle = "\(titles[0])\(suffix)"

        return DayEntrySummary(
            title: isDone ? "Completed \(baseTitle)" : baseTitle,
            trailing: "\(completedCount)/\(totalCount)",
            isLogged: isDone
        )
    }

    // Builds display text for reflection/free-text rows.
    func freeTextSummary(_ value: String?, emptyTitle: String) -> DayEntrySummary {
        guard let text = nonEmpty(value) else {
            return DayEntrySummary(title: emptyTitle, trailing: nil, isLogged: false)
        }

        return DayEntrySummary(
            title: trimmedPreview(text),
            trailing: nil,
            isLogged: true
        )
    }
}
