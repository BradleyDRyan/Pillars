import SwiftUI

// Small text helpers shared by summary builders.
extension DayView {
    // Converts "HH:mm" time text into a friendlier clock format.
    func formatClock(_ value: String?) -> String? {
        guard let raw = nonEmpty(value) else { return nil }

        let parser = DateFormatter()
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.timeZone = .current
        parser.dateFormat = "HH:mm"

        if let date = parser.date(from: raw) {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = .current
            formatter.dateFormat = "h:mma"
            return formatter.string(from: date).lowercased()
        }

        return raw
    }

    // Shortens long text so it fits in one row.
    func trimmedPreview(_ text: String, maxLength: Int = 50) -> String {
        let oneLine = text.replacingOccurrences(of: "\n", with: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        guard oneLine.count > maxLength else { return oneLine }
        return String(oneLine.prefix(maxLength)) + "..."
    }

    // Returns nil for empty/whitespace-only text.
    func nonEmpty(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
