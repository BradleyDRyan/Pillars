import SwiftUI

// Summary text for sleep and mood entries.
extension DayView {
    // Builds display text for the sleep row.
    func sleepSummary(_ data: SleepData?) -> DayEntrySummary {
        guard let data else {
            return DayEntrySummary(title: "Log sleep", trailing: nil, isLogged: false)
        }

        let hasEntry = nonEmpty(data.bedtime) != nil
            || nonEmpty(data.wakeTime) != nil
            || abs(data.durationHours - 8) > 0.01
            || data.quality != 3

        let title: String
        if let wake = formatClock(data.wakeTime) {
            title = "Woke up at \(wake)"
        } else if let bedtime = formatClock(data.bedtime) {
            title = "Slept at \(bedtime)"
        } else {
            title = hasEntry ? "Sleep logged" : "Log sleep"
        }

        let scorePercent = Int(round((Double(data.quality) / 5.0) * 100))
        let trailing = hasEntry ? "\(scorePercent)% sleep score" : nil
        return DayEntrySummary(title: title, trailing: trailing, isLogged: hasEntry)
    }

    // Builds display text for the mood row.
    func moodSummary(_ data: SliderData?) -> DayEntrySummary {
        guard let sliders = data?.sliders, !sliders.isEmpty else {
            return DayEntrySummary(title: "Mood check-in", trailing: nil, isLogged: false)
        }

        let hasEntry = sliders.contains { abs($0.value - 5.0) > 0.01 }
        let average = sliders.map(\.value).reduce(0, +) / Double(sliders.count)
        let scorePercent = Int(round((average / 10.0) * 100))

        return DayEntrySummary(
            title: hasEntry ? "Checked in on mood" : "Mood check-in",
            trailing: hasEntry ? "\(scorePercent)%" : nil,
            isLogged: hasEntry
        )
    }
}
