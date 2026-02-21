import SwiftUI

// Shows the Day title and the 7-day date picker row.
// This component only handles date display and date selection.
struct DayDateHeaderView: View {
    // The currently selected day from the parent screen.
    @Binding var selectedDate: Date

    // Header layout: title on top, week selector below.
    var body: some View {
        VStack(alignment: .leading, spacing: S2.MyDay.Spacing.spacing20) {
            HStack(spacing: S2.MyDay.Spacing.compact) {
                S2ScreenHeaderView(title: dayHeaderTitle)
                Spacer()
            }
            weekSelector
        }
    }

    // Uses "Today" when possible, otherwise a short date.
    private var dayHeaderTitle: String {
        if Calendar.current.isDateInToday(selectedDate) {
            return "Today"
        }
        return formattedDayTitle(selectedDate)
    }

    // Horizontal list of the current week. Tapping a day updates selection.
    private var weekSelector: some View {
        let dates = weekDates(containing: selectedDate)

        return HStack(spacing: S2.MyDay.Spacing.compact) {
            ForEach(dates, id: \.self) { date in
                Button {
                    selectedDate = Calendar.current.startOfDay(for: date)
                } label: {
                    VStack(spacing: S2.MyDay.Spacing.compact) {
                        Text(weekdayAbbrev(for: date))
                            .font(S2.MyDay.Typography.caption)
                            .foregroundColor(S2.Semantics.onSurfaceSecondary)
                        Text(dayNumber(for: date))
                            .font(S2.MyDay.Typography.fieldValue)
                            .foregroundColor(S2.Semantics.onSurfacePrimary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, S2.MyDay.Spacing.fieldStack)
                    .background(
                        RoundedRectangle(cornerRadius: S2.CornerRadius.md, style: .continuous)
                            .fill(isSelected(date) ? S2.Semantics.surface : Color.clear)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: S2.CornerRadius.md, style: .continuous)
                            .stroke(
                                isSelected(date) ? S2.Semantics.onSurfaceSecondary.opacity(0.35) : Color.clear,
                                lineWidth: 1
                            )
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    // Converts a date into a short title for the header.
    private func formattedDayTitle(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    // Builds the 7 dates for the week containing the selected day.
    private func weekDates(containing date: Date) -> [Date] {
        var isoCalendar = Calendar(identifier: .iso8601)
        isoCalendar.timeZone = .current

        let start = isoCalendar.date(
            from: isoCalendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)
        ) ?? Calendar.current.startOfDay(for: date)

        return (0..<7).compactMap { dayOffset in
            isoCalendar.date(byAdding: .day, value: dayOffset, to: start)
        }
    }

    // Returns a short weekday label, for example "Mo" or "Tu".
    private func weekdayAbbrev(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "EEE"
        let text = formatter.string(from: date)
        return String(text.prefix(2))
    }

    // Returns the numeric day for the date cell.
    private func dayNumber(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "d"
        return formatter.string(from: date)
    }

    // True when a date cell is the currently selected day.
    private func isSelected(_ date: Date) -> Bool {
        Calendar.current.isDate(date, inSameDayAs: selectedDate)
    }
}
