//
//  HabitView.swift
//  Pillars
//
//  Habits tab backed by My Day projected habit blocks.
//

import SwiftUI

struct HabitView: View {
    @EnvironmentObject private var firebaseManager: FirebaseManager
    @StateObject private var viewModel = HabitViewModel()
    @StateObject private var pillarPickerSource = PillarPickerDataSource()
    @State private var loadedUserId: String?
    @State private var newHabitTitle = ""
    @State private var selectedPillarFilter = PillarFilter.all
    @State private var pillarPickerTarget: Habit?

    private enum PillarFilter: Equatable {
        case all
        case untagged
        case pillar(String)
    }

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading {
                    ProgressView("Loading habits…")
                        .font(S2.MyDay.Typography.helper)
                        .tint(S2.MyDay.Colors.interactiveTint)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.day != nil {
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
                pillarPickerSource.stopListening()
                return
            }
            guard loadedUserId != userId else { return }

            loadedUserId = userId
            pillarPickerSource.startListening(userId: userId)
            viewModel.loadToday(userId: userId)
        }
        .sheet(item: $pillarPickerTarget) { target in
            PillarPickerSheet(
                title: "Retag Habit",
                pillars: pillarPickerSource.pillars,
                selectedPillarId: target.pillarId
            ) { selectedPillarId in
                viewModel.setHabitPillar(habitId: target.habitId, pillarId: selectedPillarId)
            }
        }
    }

    private var addHabitRow: some View {
        HStack(spacing: S2.Spacing.sm) {
            TextField("Add a habit…", text: $newHabitTitle)
                .font(S2.MyDay.Typography.fieldValue)
                .submitLabel(.done)
                .onSubmit { commitNewHabit() }
                .s2MyDayInputSurface()

            Button(action: commitNewHabit) {
                Image(systemName: "plus")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(S2.MyDay.Colors.interactiveTint)
                    .frame(width: 38, height: 38)
                    .background(S2.MyDay.Colors.iconBackground)
                    .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.sm, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(newHabitTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
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
            ForEach(habitEntries) { entry in
                habitRow(entry)
            }
        }
    }

    private func habitRow(_ entry: Habit) -> some View {
        ListRow(swipeDelete: { deleteHabit(entry) }) {
            Button {
                toggleHabit(entry)
            } label: {
                Image(systemName: entry.item.isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: S2.MyDay.Icon.checklistSize))
                    .foregroundColor(entry.item.isCompleted ? S2.MyDay.Colors.interactiveTint : S2.MyDay.Colors.disabledIcon)
            }
            .buttonStyle(.plain)
        } title: {
            Text(entry.item.title)
                .font(S2.MyDay.Typography.fieldValue)
                .foregroundColor(entry.item.isCompleted ? S2.MyDay.Colors.subtitleText : S2.MyDay.Colors.titleText)
                .strikethrough(entry.item.isCompleted, color: S2.MyDay.Colors.subtitleText)
                .frame(maxWidth: .infinity, alignment: .leading)
        } subtitle: {
            Text(entry.section.displayName)
                .font(S2.MyDay.Typography.fieldLabel)
                .foregroundColor(S2.MyDay.Colors.subtitleText)
        } trailing: {
            HStack(spacing: S2.Spacing.xs) {
                PillarTagChip(
                    title: pillarLabel(for: entry.pillarId),
                    color: pillarColor(for: entry.pillarId)
                )

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
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: S2.Spacing.sm) {
            Text("No habits yet.")
                .font(S2.MyDay.Typography.emptyState)
                .foregroundColor(S2.MyDay.Colors.subtitleText)

            Text("Add one above. It syncs with your Morning Habits in My Day.")
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
                    viewModel.loadToday(userId: userId)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(S2.Spacing.xxl)
        .background(S2.MyDay.Colors.pageBackground)
    }

    private var habitEntries: [Habit] {
        guard let day = viewModel.day else { return [] }

        let sectionOrder = DaySection.TimeSection.allCases
        let sectionRank = Dictionary(uniqueKeysWithValues: sectionOrder.enumerated().map { ($1, $0) })
        var entries: [Habit] = []

        for section in sectionOrder {
            let blocks = day.sections.first(where: { $0.id == section })?.blocks ?? []
            for block in blocks where block.typeId == "habits" {
                guard let habitId = viewModel.projectedHabitId(for: block) else { continue }
                let items = block.checklistData?.items ?? []
                for (itemIndex, item) in items.enumerated() {
                    let title = item.title.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !title.isEmpty else { continue }
                    entries.append(
                        Habit(
                            blockId: block.id,
                            section: section,
                            habitId: habitId,
                            pillarId: block.pillarId,
                            block: block,
                            item: item,
                            itemIndex: itemIndex
                        )
                    )
                }
            }
        }

        let sorted = entries.sorted { lhs, rhs in
            let lhsSection = sectionRank[lhs.section] ?? 0
            let rhsSection = sectionRank[rhs.section] ?? 0
            if lhsSection != rhsSection { return lhsSection < rhsSection }
            if lhs.block.order != rhs.block.order { return lhs.block.order < rhs.block.order }
            return lhs.itemIndex < rhs.itemIndex
        }

        return sorted.filter { entry in
            switch selectedPillarFilter {
            case .all:
                return true
            case .untagged:
                return entry.pillarId == nil
            case .pillar(let pillarId):
                return entry.pillarId == pillarId
            }
        }
    }

    private func toggleHabit(_ entry: Habit) {
        var block = entry.block
        guard var items = block.checklistData?.items else { return }
        guard let idx = items.firstIndex(where: { $0.id == entry.item.id }) else { return }

        items[idx].isCompleted.toggle()
        block.checklistData = ChecklistData(items: items)
        viewModel.updateBlock(block, in: entry.section)
    }

    private func deleteHabit(_ entry: Habit) {
        var block = entry.block
        guard var items = block.checklistData?.items else { return }

        items.removeAll { $0.id == entry.item.id }
        if items.isEmpty {
            viewModel.deleteBlock(block.id, from: entry.section)
            return
        }

        block.checklistData = ChecklistData(items: items)
        viewModel.updateBlock(block, in: entry.section)
    }

    private func commitNewHabit() {
        let trimmed = newHabitTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        viewModel.addHabitItem(title: trimmed)
        newHabitTitle = ""
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
}

#Preview {
    HabitView()
        .environmentObject(FirebaseManager.shared)
}
