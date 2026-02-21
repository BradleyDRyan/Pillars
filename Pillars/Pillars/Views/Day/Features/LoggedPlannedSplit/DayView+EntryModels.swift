import SwiftUI

// Shared data shapes for Day entry rows.
// These keep the list builder, summary text, and row UI in sync.
extension DayView {
    // Whether an entry belongs above or below the divider.
    enum DayEntryStatus {
        case logged
        case planned
    }

    // The data needed to draw one row in the Day list.
    struct DayEntry: Identifiable {
        let id: String
        let section: DaySection.TimeSection
        let blockId: String
        let title: String
        let trailing: String?
        let status: DayEntryStatus
    }

    // The title and helper text shown in one row.
    struct DayEntrySummary {
        let title: String
        let trailing: String?
        let isLogged: Bool
    }
}
