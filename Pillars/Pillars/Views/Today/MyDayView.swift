//
//  MyDayView.swift
//  Pillars
//
//  Main container for daily logging
//

import SwiftUI

struct DayView: View {
    @EnvironmentObject private var firebaseManager: FirebaseManager
    @StateObject private var viewModel = DayViewModel()
    @StateObject private var pillarPickerSource = PillarPickerDataSource()
    @State private var addBlockSection: DaySection.TimeSection?
    @State private var loadedUserId: String?
    @State private var selectedDate = Calendar.current.startOfDay(for: Date())
    @State private var pillarPickerTarget: PillarPickerTarget?

    private enum JournalEntryStatus {
        case logged
        case planned
    }

    private struct JournalEntry: Identifiable {
        let id: String
        let section: DaySection.TimeSection
        let blockId: String
        let title: String
        let trailing: String?
        let status: JournalEntryStatus
    }

    private struct JournalSummary {
        let title: String
        let trailing: String?
        let isLogged: Bool
    }

    private struct PillarPickerTarget: Identifiable {
        enum Kind {
            case dayBlock(section: DaySection.TimeSection, blockId: String)
            case todo(todoId: String)
            case habit(habitId: String)
        }

        let id: String
        let currentPillarId: String?
        let kind: Kind
    }

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading {
                    ProgressView("Loading your day…")
                        .font(S2.MyDay.Typography.helper)
                        .tint(S2.MyDay.Colors.interactiveTint)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let day = viewModel.day {
                    journalContent(day: day)
                } else {
                    errorState
                }
            }
            .background(S2.MyDay.Colors.pageBackground.ignoresSafeArea())
        }
        .task(id: firebaseManager.currentUser?.uid) {
            guard let userId = firebaseManager.currentUser?.uid else {
                loadedUserId = nil
                viewModel.stopListening()
                viewModel.day = nil
                viewModel.customBlockTypes = []
                pillarPickerSource.stopListening()
                return
            }
            if loadedUserId != userId {
                loadedUserId = userId
                viewModel.loadCustomBlockTypes(userId: userId)
                pillarPickerSource.startListening(userId: userId)
            }
            viewModel.loadDay(userId: userId, dateStr: dayString(from: selectedDate))
        }
        .onChange(of: selectedDate) { _, newValue in
            guard let userId = firebaseManager.currentUser?.uid else { return }
            viewModel.loadDay(userId: userId, dateStr: dayString(from: newValue))
        }
        .sheet(item: $addBlockSection) { section in
            AddBlockSheet(
                builtIns: viewModel.allBlockTypes.builtIns,
                customTypes: viewModel.allBlockTypes.custom
            ) { typeId, customType in
                viewModel.addBlock(typeId: typeId, to: section, customType: customType)
            }
        }
        .sheet(item: $pillarPickerTarget) { target in
            PillarPickerSheet(
                title: "Assign Pillar",
                pillars: pillarPickerSource.pillars,
                selectedPillarId: target.currentPillarId
            ) { selectedPillarId in
                applyPillarSelection(selectedPillarId, for: target)
            }
        }
    }

    private var errorState: some View {
        VStack(spacing: S2.MyDay.Spacing.sectionContent) {
            Text(viewModel.errorMessage ?? "Could not load your day.")
                .font(S2.MyDay.Typography.emptyState)
                .foregroundColor(S2.MyDay.Colors.subtitleText)
                .multilineTextAlignment(.center)

            S2Button(title: "Retry", variant: .primary, size: .small, fullWidth: false, centerContent: true) {
                if let userId = firebaseManager.currentUser?.uid {
                    viewModel.loadCustomBlockTypes(userId: userId)
                    viewModel.loadDay(userId: userId, dateStr: dayString(from: selectedDate))
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(S2.MyDay.Spacing.errorPadding)
        .background(S2.MyDay.Colors.pageBackground)
    }

    private var dateHeader: some View {
        VStack(alignment: .leading, spacing: S2.MyDay.Spacing.spacing20) {
            S2ScreenHeaderView(title: dayHeaderTitle)
            weekSelector
        }
    }

    private var dayHeaderTitle: String {
        if Calendar.current.isDateInToday(selectedDate) {
            return "Today"
        }
        return formattedDayTitle(selectedDate)
    }

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
                            .foregroundColor(S2.MyDay.Colors.subtitleText)
                        Text(dayNumber(for: date))
                            .font(S2.MyDay.Typography.fieldValue)
                            .foregroundColor(S2.MyDay.Colors.titleText)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, S2.MyDay.Spacing.fieldStack)
                    .background(
                        RoundedRectangle(cornerRadius: S2.CornerRadius.md, style: .continuous)
                            .fill(isSelected(date) ? S2.MyDay.Colors.sectionBackground : Color.clear)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: S2.CornerRadius.md, style: .continuous)
                            .stroke(
                                isSelected(date) ? S2.MyDay.Colors.subtitleText.opacity(0.35) : Color.clear,
                                lineWidth: 1
                            )
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func journalContent(day: Day) -> some View {
        let entries = journalEntries(from: day)
        let logged = entries.filter { $0.status == .logged }
        let planned = entries.filter { $0.status == .planned }

        return ScrollView {
            VStack(alignment: .leading, spacing: S2.MyDay.Spacing.spacing20) {
                dateHeader
                journalSection(title: "Logged", entries: logged, emptyText: "No entries logged yet.")
                journalSection(title: "Planned", entries: planned, emptyText: "No planned entries.")
            }
            .padding(.horizontal, S2.MyDay.Spacing.pageHorizontal)
            .padding(.vertical, S2.MyDay.Spacing.pageVertical)
        }
        .background(S2.MyDay.Colors.pageBackground)
    }

    private func journalSection(title: String, entries: [JournalEntry], emptyText: String) -> some View {
        VStack(alignment: .leading, spacing: S2.MyDay.Spacing.sectionContent) {
            Text(title)
                .font(S2.MyDay.Typography.sectionLabel)
                .foregroundColor(S2.MyDay.Colors.subtitleText)

            if entries.isEmpty {
                Text(emptyText)
                    .font(S2.MyDay.Typography.emptyState)
                    .foregroundColor(S2.MyDay.Colors.subtitleText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, S2.MyDay.Spacing.emptyStateVertical)
            } else {
                VStack(spacing: S2.MyDay.Spacing.blockStack) {
                    ForEach(entries) { entry in
                        if let blockBinding = blockBinding(for: entry.blockId, in: entry.section) {
                            DayBlockView(
                                block: blockBinding,
                                customTypes: viewModel.customBlockTypes,
                                onDelete: {
                                    viewModel.deleteBlock(entry.blockId, from: entry.section)
                                },
                                titleOverride: entry.title,
                                trailingOverride: entry.trailing,
                                showIcon: true,
                                pillarTag: pillarTag(for: blockBinding.wrappedValue),
                                onPillarTap: {
                                    presentPillarPicker(for: entry.section, blockId: entry.blockId)
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    private func blockBinding(for blockId: String, in section: DaySection.TimeSection) -> Binding<Block>? {
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

    private func blockValue(for blockId: String, in section: DaySection.TimeSection) -> Block? {
        guard let day = viewModel.day,
              let sectionIndex = day.sections.firstIndex(where: { $0.id == section }),
              let block = day.sections[sectionIndex].blocks.first(where: { $0.id == blockId }) else {
            return nil
        }
        return block
    }

    private func pillarTag(for block: Block) -> DayBlockView.PillarTagDisplay {
        if let pillar = pillarPickerSource.pillar(for: block.pillarId) {
            return DayBlockView.PillarTagDisplay(title: pillar.name, color: pillar.colorValue)
        }
        if block.pillarId != nil {
            return DayBlockView.PillarTagDisplay(
                title: "Tagged",
                color: S2.MyDay.Colors.subtitleText
            )
        }
        return DayBlockView.PillarTagDisplay(
            title: "No Pillar",
            color: S2.MyDay.Colors.subtitleText
        )
    }

    private func presentPillarPicker(for section: DaySection.TimeSection, blockId: String) {
        guard let block = blockValue(for: blockId, in: section) else { return }

        if let todoId = viewModel.projectedTodoId(for: block) {
            pillarPickerTarget = PillarPickerTarget(
                id: "todo:\(todoId)",
                currentPillarId: block.pillarId,
                kind: .todo(todoId: todoId)
            )
            return
        }

        if let habitId = viewModel.projectedHabitId(for: block) {
            pillarPickerTarget = PillarPickerTarget(
                id: "habit:\(habitId)",
                currentPillarId: block.pillarId,
                kind: .habit(habitId: habitId)
            )
            return
        }

        pillarPickerTarget = PillarPickerTarget(
            id: "day:\(section.rawValue):\(blockId)",
            currentPillarId: block.pillarId,
            kind: .dayBlock(section: section, blockId: blockId)
        )
    }

    private func applyPillarSelection(_ pillarId: String?, for target: PillarPickerTarget) {
        switch target.kind {
        case .todo(let todoId):
            viewModel.setTodoPillar(todoId: todoId, pillarId: pillarId)
        case .habit(let habitId):
            viewModel.setHabitPillar(habitId: habitId, pillarId: pillarId)
        case .dayBlock(let section, let blockId):
            viewModel.setDayBlockPillar(blockId: blockId, section: section, pillarId: pillarId)
        }
    }

    private func journalEntries(from day: Day) -> [JournalEntry] {
        var entries: [JournalEntry] = []

        for section in DaySection.TimeSection.allCases {
            let blocks = day.sections
                .first(where: { $0.id == section })?
                .blocks
                .sorted(by: { $0.order < $1.order }) ?? []

            for block in blocks {
                let summary = journalSummary(for: block)
                let entry = JournalEntry(
                    id: "\(section.rawValue)-\(block.id)",
                    section: section,
                    blockId: block.id,
                    title: summary.title,
                    trailing: summary.trailing,
                    status: summary.isLogged ? .logged : .planned
                )
                entries.append(entry)
            }
        }

        return entries
    }

    private func journalSummary(for block: Block) -> JournalSummary {
        if let builtIn = block.blockType {
            switch builtIn.id {
            case "sleep":
                return sleepSummary(block.sleepData)
            case "feeling":
                return moodSummary(block.sliderData)
            case "habits":
                return morningHabitsSummary(block.checklistData)
            case "workout":
                return workoutSummary(block.textFieldData)
            case "todo":
                return todoSummary(block.checklistData)
            case "reflection":
                return freeTextSummary(block.freeText, emptyTitle: "Add reflection")
            default:
                return JournalSummary(title: builtIn.name, trailing: nil, isLogged: false)
            }
        }

        if let customType = customType(for: block) {
            return customSummary(block: block, customType: customType)
        }

        return JournalSummary(title: "Unknown entry", trailing: nil, isLogged: false)
    }

    private func sleepSummary(_ data: SleepData?) -> JournalSummary {
        guard let data else {
            return JournalSummary(title: "Log sleep", trailing: nil, isLogged: false)
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
        return JournalSummary(title: title, trailing: trailing, isLogged: hasEntry)
    }

    private func moodSummary(_ data: SliderData?) -> JournalSummary {
        guard let sliders = data?.sliders, !sliders.isEmpty else {
            return JournalSummary(title: "Mood check-in", trailing: nil, isLogged: false)
        }

        let hasEntry = sliders.contains { abs($0.value - 5.0) > 0.01 }
        let average = sliders.map(\.value).reduce(0, +) / Double(sliders.count)
        let scorePercent = Int(round((average / 10.0) * 100))

        return JournalSummary(
            title: hasEntry ? "Checked in on mood" : "Mood check-in",
            trailing: hasEntry ? "\(scorePercent)%" : nil,
            isLogged: hasEntry
        )
    }

    private func morningHabitsSummary(_ data: ChecklistData?) -> JournalSummary {
        let items = data?.items ?? []
        let total = items.count
        let completed = items.filter(\.isCompleted).count

        guard total > 0 else {
            return JournalSummary(title: "Morning habits", trailing: nil, isLogged: false)
        }

        if completed > 0 {
            return JournalSummary(
                title: "Completed \(completed)/\(total) morning habits",
                trailing: nil,
                isLogged: true
            )
        }

        return JournalSummary(
            title: "Morning habits planned",
            trailing: "\(total) items",
            isLogged: false
        )
    }

    private func workoutSummary(_ data: TextFieldData?) -> JournalSummary {
        let type = textFieldValue(data, id: "type")
        let duration = textFieldValue(data, id: "duration")
        let notes = textFieldValue(data, id: "notes")
        let hasEntry = [type, duration, notes].contains(where: { $0 != nil })

        if let type {
            return JournalSummary(title: type, trailing: duration, isLogged: true)
        }

        if let notes {
            return JournalSummary(title: notes, trailing: duration, isLogged: true)
        }

        return JournalSummary(
            title: hasEntry ? "Workout logged" : "Plan workout",
            trailing: duration,
            isLogged: hasEntry
        )
    }

    private func todoSummary(_ data: ChecklistData?) -> JournalSummary {
        let items = data?.items ?? []
        let titles = items
            .map(\.title)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        guard !titles.isEmpty else {
            return JournalSummary(title: "Add a to-do", trailing: nil, isLogged: false)
        }

        let completedCount = items.filter(\.isCompleted).count
        let totalCount = max(1, items.count)
        let isDone = completedCount == totalCount
        let extra = max(0, titles.count - 1)
        let suffix = extra > 0 ? " +\(extra)" : ""
        let baseTitle = "\(titles[0])\(suffix)"

        return JournalSummary(
            title: isDone ? "Completed \(baseTitle)" : baseTitle,
            trailing: "\(completedCount)/\(totalCount)",
            isLogged: isDone
        )
    }

    private func freeTextSummary(_ value: String?, emptyTitle: String) -> JournalSummary {
        guard let text = nonEmpty(value) else {
            return JournalSummary(title: emptyTitle, trailing: nil, isLogged: false)
        }

        return JournalSummary(
            title: trimmedPreview(text),
            trailing: nil,
            isLogged: true
        )
    }

    private func customSummary(block: Block, customType: CustomBlockType) -> JournalSummary {
        let values = block.customData ?? []
        let hasEntry = customType.fields.contains { field in
            guard let value = values.first(where: { $0.id == field.id }) else { return false }
            switch field.type {
            case .text, .multiline:
                return nonEmpty(value.textValue) != nil
            case .number, .slider, .rating:
                return (value.numberValue ?? 0) != 0
            case .toggle:
                return value.boolValue == true
            }
        }

        return JournalSummary(
            title: hasEntry ? "\(customType.name) logged" : customType.name,
            trailing: nil,
            isLogged: hasEntry
        )
    }

    private func customType(for block: Block) -> CustomBlockType? {
        viewModel.customBlockTypes.first(where: { $0.id == block.typeId })
    }

    private func textFieldValue(_ data: TextFieldData?, id: String) -> String? {
        guard let field = data?.fields.first(where: { $0.id == id }) else { return nil }
        return nonEmpty(field.value)
    }

    private func formatClock(_ value: String?) -> String? {
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

    private func trimmedPreview(_ text: String, maxLength: Int = 50) -> String {
        let oneLine = text.replacingOccurrences(of: "\n", with: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        guard oneLine.count > maxLength else { return oneLine }
        return String(oneLine.prefix(maxLength)) + "…"
    }

    private func nonEmpty(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func formattedDayTitle(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    private func dayString(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

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

    private func weekdayAbbrev(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "EEE"
        let text = formatter.string(from: date)
        return String(text.prefix(2))
    }

    private func dayNumber(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "d"
        return formatter.string(from: date)
    }

    private func isSelected(_ date: Date) -> Bool {
        Calendar.current.isDate(date, inSameDayAs: selectedDate)
    }
}

typealias MyDayView = DayView

#Preview {
    DayView()
        .environmentObject(FirebaseManager.shared)
}
