//
//  HabitView.swift
//  Pillars
//
//  Habits tab backed by habit primitives.
//

import SwiftUI

struct HabitView: View {
    @EnvironmentObject private var firebaseManager: FirebaseManager
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var viewModel = HabitViewModel()
    @StateObject private var pillarPickerSource = PillarPickerDataSource()
    @State private var loadedUserId: String?
    @State private var newHabitTitle = ""
    @State private var selectedPillarFilter = PillarFilter.all
    @State private var pillarPickerTarget: ScheduledHabit?
    @State private var showingCreateHabitSheet = false
    @State private var habitToEdit: ScheduledHabit?

    private enum PillarFilter: Equatable {
        case all
        case untagged
        case pillar(String)
    }

    private struct HabitGroupBucket: Identifiable {
        let id: String
        let title: String
        let items: [ScheduledHabit]
    }

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading {
                    ProgressView("Loading habits…")
                        .font(S2.MyDay.Typography.helper)
                        .tint(S2.MyDay.Colors.interactiveTint)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.errorMessage != nil && habitEntries.isEmpty {
                    errorState
                } else {
                    ScrollView {
                        VStack(spacing: S2.Spacing.md) {
                            S2ScreenHeaderView(title: "Habits")
                            addHabitRow
                            pillarFilterRow

                            if habitEntries.isEmpty {
                                emptyState
                            } else {
                                habitsList
                            }
                        }
                        .padding(.horizontal, S2.MyDay.Spacing.pageHorizontal)
                        .padding(.vertical, S2.MyDay.Spacing.pageVertical)
                    }
                    .background(S2.MyDay.Colors.pageBackground)
                }
            }
            .background(S2.MyDay.Colors.pageBackground.ignoresSafeArea())
        }
        .task(id: firebaseManager.currentUser?.uid) {
            guard let userId = firebaseManager.currentUser?.uid else {
                loadedUserId = nil
                viewModel.stopListening()
                pillarPickerSource.stopListening()
                return
            }
            guard loadedUserId != userId else { return }

            loadedUserId = userId
            pillarPickerSource.startListening(userId: userId)
            viewModel.loadHabits(userId: userId, date: Day.todayDateString)
        }
        .onAppear {
            reloadHabitsForCurrentUser()
        }
        .onChange(of: scenePhase) { _, newPhase in
            guard newPhase == .active else { return }
            reloadHabitsForCurrentUser()
        }
        .sheet(item: $pillarPickerTarget) { target in
            PillarPickerSheet(
                title: "Retag Habit",
                pillars: pillarPickerSource.pillars,
                selectedPillarId: target.pillarId
            ) { selectedPillarId in
                viewModel.setHabitPillar(habitId: target.id, pillarId: selectedPillarId)
            }
        }
        .sheet(item: $habitToEdit) { target in
            EditHabitSheet(
                initialInput: habitEditInput(for: target),
                habitGroups: viewModel.habitGroups,
                pillars: pillarPickerSource.pillars
            ) { input in
                print("🧾 [Habits] Edit callback invoked with title='\(input.title)' habitId='\(target.id)'")
                viewModel.updateHabit(habitId: target.id, input: input)
            } onDelete: {
                print("🗑️ [Habits] Delete callback invoked for habitId='\(target.id)'")
                viewModel.deleteHabit(habitId: target.id)
            }
        }
        .sheet(isPresented: $showingCreateHabitSheet) {
            CreateHabitSheet(
                initialTitle: newHabitTitle,
                habitGroups: viewModel.habitGroups,
                pillars: pillarPickerSource.pillars
            ) { input in
                print("🧪 [Habits] Create callback invoked with title='\(input.title)'")
                viewModel.createHabit(input)
                newHabitTitle = ""
            }
        }
    }

    private var addHabitRow: some View {
        HStack(spacing: S2.Spacing.sm) {
            TextField("Add a habit…", text: $newHabitTitle)
                .font(S2.MyDay.Typography.fieldValue)
                .submitLabel(.done)
                .onSubmit {
                    print("🧾 [Habits] Enter pressed on quick add with title='\(newHabitTitle)'")
                    openCreateHabitSheet()
                }
                .s2MyDayInputSurface()

            Button(action: openCreateHabitSheet) {
                Image(systemName: "plus")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(S2.MyDay.Colors.interactiveTint)
                    .frame(width: 38, height: 38)
                    .background(S2.MyDay.Colors.iconBackground)
                    .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.sm, style: .continuous))
            }
            .buttonStyle(.plain)
        }
    }

    private var pillarFilterRow: some View {
        HStack(spacing: S2.Spacing.sm) {
            Text("Filter")
                .font(S2.MyDay.Typography.fieldLabel)
                .foregroundColor(S2.MyDay.Colors.subtitleText)

            Spacer()

            Menu {
                Button("All") {
                    selectedPillarFilter = .all
                }
                Button("Untagged") {
                    selectedPillarFilter = .untagged
                }
                if !pillarPickerSource.pillars.isEmpty {
                    Divider()
                    ForEach(pillarPickerSource.pillars) { pillar in
                        Button(pillar.name) {
                            selectedPillarFilter = .pillar(pillar.id)
                        }
                    }
                }
            } label: {
                Text(filterLabel)
                    .font(S2.MyDay.Typography.fieldValue)
                    .foregroundColor(S2.MyDay.Colors.titleText)
                    .padding(.horizontal, S2.Spacing.sm)
                    .padding(.vertical, S2.Spacing.xs)
                    .background(S2.MyDay.Colors.sectionBackground)
                    .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.sm, style: .continuous))
            }
            .buttonStyle(.plain)
        }
    }

    private var habitsList: some View {
        VStack(spacing: S2.MyDay.Spacing.blockStack) {
            ForEach(groupedHabitEntries) { bucket in
                VStack(alignment: .leading, spacing: S2.Spacing.xs) {
                    Text(bucket.title)
                        .font(S2.MyDay.Typography.fieldLabel)
                        .foregroundColor(S2.MyDay.Colors.subtitleText)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    VStack(spacing: S2.MyDay.Spacing.blockStack) {
                        ForEach(bucket.items) { entry in
                            habitRow(entry)
                        }
                    }
                }
            }
        }
    }

    private func habitRow(_ entry: ScheduledHabit) -> some View {
        let isCompleted = entry.isCompleted
        let isSkipped = entry.isSkipped
        let textColor = isCompleted || isSkipped ? S2.MyDay.Colors.subtitleText : S2.MyDay.Colors.titleText

        return ListRow(swipeDelete: { viewModel.deleteHabit(habitId: entry.id) }) {
            EmptyView()
        } title: {
            Button(action: { openHabitEditor(entry) }) {
                Text(entry.name)
                    .font(S2.MyDay.Typography.fieldValue)
                    .foregroundColor(textColor)
                    .strikethrough(isCompleted || isSkipped, color: S2.MyDay.Colors.subtitleText)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
        } subtitle: {
            Button(action: { openHabitEditor(entry) }) {
                Text(scheduleLabel(for: entry))
                    .font(S2.MyDay.Typography.fieldLabel)
                    .foregroundColor(S2.MyDay.Colors.subtitleText)
            }
            .buttonStyle(.plain)
        } trailing: {
            HStack(spacing: S2.Spacing.xs) {
                PillarTagChip(
                    title: pillarLabel(for: entry.pillarId),
                    color: pillarColor(for: entry.pillarId)
                )

                if isSkipped {
                    Text("Skipped")
                        .font(S2.MyDay.Typography.fieldLabel)
                        .foregroundColor(S2.MyDay.Colors.destructive)
                        .padding(.horizontal, S2.Spacing.xs)
                        .padding(.vertical, 3)
                        .background(S2.MyDay.Colors.sectionBackground)
                        .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.sm, style: .continuous))
                }

                Button {
                    pillarPickerTarget = entry
                } label: {
                    Image(systemName: "tag")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(S2.MyDay.Colors.subtitleText)
                        .padding(6)
                        .background(S2.MyDay.Colors.sectionBackground)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)

                S2MyDayDoneIconButton(
                    isCompleted: isCompleted,
                    size: .compact,
                ) {
                    toggleHabit(entry)
                }

                Menu {
                    if isSkipped {
                        Button {
                            markHabitPending(entry)
                        } label: {
                            Label("Unskip", systemImage: "arrow.uturn.left")
                        }
                    } else {
                        Button {
                            skipHabit(entry)
                        } label: {
                            Label("Skip today", systemImage: "slash.circle")
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(S2.MyDay.Colors.subtitleText)
                        .padding(6)
                        .background(S2.MyDay.Colors.sectionBackground)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: S2.Spacing.sm) {
            Text("No habits yet.")
                .font(S2.MyDay.Typography.emptyState)
                .foregroundColor(S2.MyDay.Colors.subtitleText)

            Text("Add one above. It syncs with your habit primitive and My Day.")
                .font(S2.MyDay.Typography.fieldLabel)
                .foregroundColor(S2.MyDay.Colors.subtitleText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, S2.Spacing.sm)
    }

    private var errorState: some View {
        VStack(spacing: S2.Spacing.md) {
            Text(viewModel.errorMessage ?? "Could not load habits.")
                .font(S2.MyDay.Typography.emptyState)
                .foregroundColor(S2.MyDay.Colors.subtitleText)
                .multilineTextAlignment(.center)

            S2Button(title: "Retry", variant: .primary, size: .small, fullWidth: false, centerContent: true) {
                if let userId = firebaseManager.currentUser?.uid {
                    viewModel.loadHabits(userId: userId, date: Day.todayDateString)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(S2.Spacing.xxl)
        .background(S2.MyDay.Colors.pageBackground)
    }

    private var habitEntries: [ScheduledHabit] {
        let filtered = viewModel.habits.filter { entry in
            guard !entry.isArchived else { return false }

            switch selectedPillarFilter {
            case .all:
                return true
            case .untagged:
                return entry.pillarId == nil
            case .pillar(let pillarId):
                return entry.pillarId == pillarId
            }
        }

        return filtered
    }

    private var groupedHabitEntries: [HabitGroupBucket] {
        let grouped = Dictionary(grouping: habitEntries) { entry in
            groupTitle(for: entry)
        }

        let sortedKeys = grouped.keys.sorted { lhs, rhs in
            if lhs == rhs { return false }
            if lhs == "No Group" { return true }
            if rhs == "No Group" { return false }
            return lhs.localizedCaseInsensitiveCompare(rhs) == .orderedAscending
        }

        return sortedKeys.map { key in
            HabitGroupBucket(
                id: key,
                title: key,
                items: grouped[key] ?? []
            )
        }
    }

    private func toggleHabit(_ entry: ScheduledHabit) {
        viewModel.setHabitCompletion(
            habitId: entry.id,
            isCompleted: !entry.isCompleted,
            date: viewModel.currentDate()
        )
    }

    private func skipHabit(_ entry: ScheduledHabit) {
        viewModel.skipHabit(
            habitId: entry.id,
            date: viewModel.currentDate()
        )
    }

    private func markHabitPending(_ entry: ScheduledHabit) {
        viewModel.markHabitPending(
            habitId: entry.id,
            date: viewModel.currentDate()
        )
    }

    private func openHabitEditor(_ habit: ScheduledHabit) {
        print("🧾 [Habits] Opening edit sheet for habitId='\(habit.id)' title='\(habit.name)'")
        habitToEdit = habit
    }

    private func habitEditInput(for habit: ScheduledHabit) -> HabitCreateInput {
        let scheduleType = HabitScheduleType(
            rawValue: habit.schedule?.normalizedType.lowercased() ?? ""
        ) ?? .daily

        let selectedWeekdays: [HabitWeekday] = HabitWeekday.allCases.filter {
            habit.schedule?.normalizedDaysOfWeek.contains($0.rawValue) == true
        }

        let targetType = HabitTargetType(
            rawValue: habit.target?.type?.lowercased() ?? "binary"
        ) ?? .binary

        let targetValue = habit.target?.value ?? 1

        return HabitCreateInput(
            title: habit.name,
            groupId: habit.groupId,
            newGroupName: nil,
            scheduleType: scheduleType,
            daysOfWeek: selectedWeekdays,
            targetType: targetType,
            targetValue: targetType == .binary ? 1 : targetValue,
            targetUnit: habit.target?.unit,
            pillarId: habit.pillarId
        )
    }

    private func openCreateHabitSheet() {
        print("🪟 [Habits] opening create sheet (draftTitle='\(newHabitTitle)')")
        showingCreateHabitSheet = true
    }

    private func scheduleLabel(for entry: ScheduledHabit) -> String {
        let scheduleType = entry.schedule?.normalizedType ?? "daily"
        if scheduleType == "weekly" {
            let days = (entry.schedule?.normalizedDaysOfWeek ?? []).compactMap(dayShortLabel(for:))
            if days.isEmpty {
                return "Weekly"
            }
            return "Weekly · \(days.joined(separator: ", "))"
        }
        return "Daily"
    }

    private func dayShortLabel(for raw: String) -> String? {
        HabitWeekday(rawValue: raw)?.shortLabel
    }

    private func groupTitle(for entry: ScheduledHabit) -> String {
        let resolvedGroupName: String?
        if let groupId = entry.groupId {
            resolvedGroupName = viewModel.habitGroups.first(where: { $0.id == groupId })?.name
        } else {
            resolvedGroupName = nil
        }

        let trimmed = (resolvedGroupName ?? entry.groupName)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? "No Group" : trimmed
    }

    private var filterLabel: String {
        switch selectedPillarFilter {
        case .all:
            return "All"
        case .untagged:
            return "Untagged"
        case .pillar(let pillarId):
            return pillarPickerSource.pillarName(for: pillarId) ?? "Pillar"
        }
    }

    private func pillarLabel(for pillarId: String?) -> String {
        if let name = pillarPickerSource.pillarName(for: pillarId) {
            return name
        }
        return pillarId == nil ? "No Pillar" : "Tagged"
    }

    private func pillarColor(for pillarId: String?) -> Color {
        pillarPickerSource.pillar(for: pillarId)?.colorValue ?? S2.MyDay.Colors.subtitleText
    }

    private func reloadHabitsForCurrentUser() {
        guard let userId = firebaseManager.currentUser?.uid else { return }
        viewModel.loadHabits(userId: userId, date: Day.todayDateString)
    }
}

#Preview {
    HabitView()
        .environmentObject(FirebaseManager.shared)
}
