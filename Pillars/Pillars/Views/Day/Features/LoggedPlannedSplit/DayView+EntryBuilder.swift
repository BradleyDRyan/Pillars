import SwiftUI

// Builds the list of rows shown in the Day screen.
// It walks day sections, creates summaries, and decides if each row is
// planned or logged.
extension DayView {
    // Converts raw day blocks into display-friendly entry rows.
    func dayEntries(from day: Day) -> [DayEntry] {
        var entries: [DayEntry] = []

        // Keep section order stable so rows match the day timeline.
        for section in DaySection.TimeSection.allCases {
            let blocks = day.sections
                .first(where: { $0.id == section })?
                .blocks
                .sorted(by: { $0.order < $1.order }) ?? []

            for block in blocks {
                if isHabitStackBlock(block) {
                    let allItems = viewModel.habitStackItems(for: block)
                    let summary = habitStackSummary(block, items: allItems)
                    let status: DayEntryStatus = summary.isLogged ? .logged : .planned
                    entries.append(
                        DayEntry(
                            id: "\(block.id):group",
                            section: section,
                            blockId: block.id,
                            title: summary.title,
                            trailing: summary.trailing,
                            status: status
                        )
                    )
                    continue
                }

                // Standard blocks create one row.
                let summary = dayEntrySummary(for: block)
                let entry = DayEntry(
                    id: "\(block.id):all",
                    section: section,
                    blockId: block.id,
                    title: summary.title,
                    trailing: summary.trailing,
                    status: summary.isLogged ? .logged : .planned,
                )
                entries.append(entry)
            }
        }

        return entries
    }
}
