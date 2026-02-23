//
//  TodoView.swift
//  Pillars
//
//  Todo tab backed by todo primitives.
//

import SwiftUI

struct TodoView: View {
    @EnvironmentObject private var firebaseManager: FirebaseManager
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var viewModel = TodoViewModel()
    @StateObject private var pillarPickerSource = PillarPickerDataSource()
    @State private var loadedUserId: String?
    @State private var settings = TodoViewSettings()
    @State private var editorTarget: Todo?
    @State private var showingCreateTodoSheet = false
    @State private var showingSettingsSheet = false

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading {
                    ProgressView("Loading todos…")
                        .font(S2.MyDay.Typography.helper)
                        .tint(S2.MyDay.Colors.interactiveTint)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.errorMessage != nil && todoEntries.isEmpty {
                    errorState
                } else {
                    ScrollView {
                        VStack(spacing: S2.Spacing.md) {
                            S2ScreenHeaderView(title: "Todo")
                            createTodoButton
                            settingsRow
                            infoNotice
                            classificationNotice

                            if todoEntries.isEmpty {
                                emptyState
                            } else {
                                todoList
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
            viewModel.loadTodos(userId: userId, includeCompleted: settings.includeCompleted)
        }
        .onAppear {
            reloadTodosForCurrentUser()
        }
        .onChange(of: scenePhase) { _, newPhase in
            guard newPhase == .active else { return }
            reloadTodosForCurrentUser()
        }
        .onChange(of: settings.includeCompleted) { oldValue, newValue in
            guard oldValue != newValue else { return }
            reloadTodosForCurrentUser()
        }
        .sheet(item: $editorTarget) { target in
            TodoEditorSheet(
                todo: target,
                pillars: pillarPickerSource.pillars
            ) { title, dueDate, allocations, shouldDelete in
                if shouldDelete {
                    viewModel.deleteTodo(todoId: target.id)
                    return
                }

                let normalizedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
                if !normalizedTitle.isEmpty && normalizedTitle != target.content {
                    viewModel.setTodoContent(todoId: target.id, content: normalizedTitle)
                }

                if dueDate != target.dueDate {
                    viewModel.setTodoDueDate(todoId: target.id, dueDate: dueDate)
                }

                if !bountyAllocationsEqual(allocations, target.bountyAllocations ?? []) {
                    viewModel.setTodoBountyAllocations(todoId: target.id, allocations: allocations)
                }
            }
        }
        .sheet(isPresented: $showingCreateTodoSheet) {
            CreateTodoSheet(pillars: pillarPickerSource.pillars) { title, dueDate, assignment in
                viewModel.createTodo(title: title, dueDate: dueDate, assignment: assignment)
            }
        }
        .sheet(isPresented: $showingSettingsSheet) {
            TodoViewSettingsSheet(
                settings: $settings,
                pillars: pillarPickerSource.pillars
            )
        }
    }

    private var infoNotice: some View {
        Group {
            if let info = viewModel.infoMessage, !info.isEmpty {
                HStack(spacing: S2.Spacing.sm) {
                    Text(info)
                        .font(S2.MyDay.Typography.fieldLabel)
                        .foregroundColor(S2.MyDay.Colors.titleText)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Button {
                        viewModel.clearInfoMessage()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(S2.MyDay.Colors.subtitleText)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, S2.Spacing.sm)
                .padding(.vertical, S2.Spacing.sm)
                .background(S2.MyDay.Colors.sectionBackground)
                .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.sm, style: .continuous))
            }
        }
    }

    private var classificationNotice: some View {
        Group {
            if viewModel.isClassifyingAssignment {
                HStack(spacing: S2.Spacing.sm) {
                    ProgressView()
                        .tint(S2.MyDay.Colors.interactiveTint)

                    Text("Classifying todo and assigning points…")
                        .font(S2.MyDay.Typography.fieldLabel)
                        .foregroundColor(S2.MyDay.Colors.titleText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.horizontal, S2.Spacing.sm)
                .padding(.vertical, S2.Spacing.sm)
                .background(S2.MyDay.Colors.sectionBackground)
                .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.sm, style: .continuous))
            }
        }
    }

    private var createTodoButton: some View {
        S2Button(
            title: "Create Todo",
            variant: .primary,
            size: .small,
            fullWidth: true,
            centerContent: true
        ) {
            showingCreateTodoSheet = true
        }
    }

    private var settingsRow: some View {
        HStack(spacing: S2.Spacing.sm) {
            Text("Settings")
                .font(S2.MyDay.Typography.fieldLabel)
                .foregroundColor(S2.MyDay.Colors.subtitleText)

            Spacer()

            Button {
                showingSettingsSheet = true
            } label: {
                HStack(spacing: S2.Spacing.xs) {
                    Image(systemName: "slider.horizontal.3")
                        .font(.system(size: S2.MyDay.Icon.actionSize, weight: .semibold))
                    Text(settingsSummary)
                        .lineLimit(1)
                }
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

    private var todoList: some View {
        VStack(spacing: S2.MyDay.Spacing.blockStack) {
            ForEach(todoEntries) { entry in
                todoRow(entry)
            }
        }
    }

    private func todoRow(_ entry: Todo) -> some View {
        let completed = entry.isCompleted

        return ListRow(
            swipeDelete: { viewModel.deleteTodo(todoId: entry.id) },
            titleSubtitleSpacing: 0
        ) {
            Button {
                toggleTodo(entry)
            } label: {
                Image(systemName: completed ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: S2.MyDay.Icon.actionSize, weight: .semibold))
                    .foregroundColor(
                        completed
                            ? S2.MyDay.Colors.interactiveTint
                            : S2.MyDay.Colors.subtitleText
                    )
            }
            .buttonStyle(.plain)
        } title: {
            rowTapTarget(entry) {
                Text(entry.content)
                    .font(S2.MyDay.Typography.fieldValue)
                    .foregroundColor(completed ? S2.MyDay.Colors.subtitleText : S2.MyDay.Colors.titleText)
                    .strikethrough(completed, color: S2.MyDay.Colors.subtitleText)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        } subtitle: {
            EmptyView()
        } trailing: {
            rowTapTarget(entry) {
                HStack(spacing: S2.Spacing.xs) {
                    if viewModel.isBountyResolving(todoId: entry.id) {
                        HStack(spacing: 6) {
                            ProgressView()
                                .controlSize(.small)
                                .tint(S2.MyDay.Colors.interactiveTint)
                            Text("Scoring")
                                .font(.system(size: 13, weight: .semibold))
                        }
                        .foregroundColor(S2.MyDay.Colors.titleText)
                        .padding(.horizontal, S2.Spacing.sm)
                        .padding(.vertical, S2.Spacing.xs)
                        .background(S2.MyDay.Colors.sectionBackground.opacity(0.9))
                        .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.md, style: .continuous))
                    } else if let bounty = bountyLabel(entry) {
                        HStack(spacing: 6) {
                            Text(bounty)
                                .font(.system(size: 13, weight: .semibold))
                            Image(systemName: pointsIconSystemName(for: entry))
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(pointsIconColor(for: entry))
                        }
                        .foregroundColor(S2.MyDay.Colors.titleText)
                        .padding(.horizontal, S2.Spacing.sm)
                        .padding(.vertical, S2.Spacing.xs)
                        .background(S2.MyDay.Colors.sectionBackground.opacity(0.9))
                        .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.md, style: .continuous))
                    } else {
                        Text("—")
                            .font(S2.MyDay.Typography.fieldLabel)
                            .foregroundColor(S2.MyDay.Colors.subtitleText)
                            .padding(.horizontal, S2.Spacing.sm)
                            .padding(.vertical, S2.Spacing.xs)
                            .background(S2.MyDay.Colors.sectionBackground.opacity(0.9))
                            .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.md, style: .continuous))
                    }
                }
            }
        }
    }

    private func rowTapTarget<Content: View>(_ todo: Todo, @ViewBuilder content: () -> Content) -> some View {
        Button {
            editorTarget = todo
        } label: {
            content()
        }
        .buttonStyle(.plain)
    }

    private var emptyState: some View {
        VStack(spacing: S2.Spacing.sm) {
            Text(emptyStateTitle)
                .font(S2.MyDay.Typography.emptyState)
                .foregroundColor(S2.MyDay.Colors.subtitleText)
            Text(emptyStateMessage)
                .font(S2.MyDay.Typography.fieldLabel)
                .foregroundColor(S2.MyDay.Colors.subtitleText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, S2.Spacing.sm)
    }

    private var errorState: some View {
        VStack(spacing: S2.Spacing.md) {
            Text(viewModel.errorMessage ?? "Could not load todos.")
                .font(S2.MyDay.Typography.emptyState)
                .foregroundColor(S2.MyDay.Colors.subtitleText)
                .multilineTextAlignment(.center)

            S2Button(title: "Retry", variant: .primary, size: .small, fullWidth: false, centerContent: true) {
                if let userId = firebaseManager.currentUser?.uid {
                    viewModel.loadTodos(userId: userId, includeCompleted: settings.includeCompleted)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(S2.Spacing.xxl)
        .background(S2.MyDay.Colors.pageBackground)
    }

    private var todoEntries: [Todo] {
        let filtered = viewModel.todos.filter { item in
            let isScheduled = item.dueDate != nil
            if isScheduled && !settings.includeScheduled {
                return false
            }
            if !isScheduled && !settings.includeUnscheduled {
                return false
            }

            switch settings.pillarScope {
            case .all:
                return true
            case .untagged:
                return item.allocationPillarIds.isEmpty
            case .pillar(let pillarId):
                return item.allocationPillarIds.contains(pillarId)
            }
        }

        return filtered.sorted { lhs, rhs in
            switch (lhs.dueDate, rhs.dueDate) {
            case let (left?, right?):
                if left != right {
                    return left < right
                }
            case (nil, _?):
                return true
            case (_?, nil):
                return false
            default:
                break
            }

            let leftCreated = lhs.createdAt ?? 0
            let rightCreated = rhs.createdAt ?? 0
            if leftCreated != rightCreated {
                return leftCreated < rightCreated
            }
            return lhs.id < rhs.id
        }
    }

    private func bountyLabel(_ todo: Todo) -> String? {
        guard let points = todo.resolvedBountyPoints, points > 0 else { return nil }
        return "+\(points)"
    }

    private func toggleTodo(_ entry: Todo) {
        viewModel.setTodoCompletion(todoId: entry.id, isCompleted: !entry.isCompleted)
    }

    private func bountyAllocationsEqual(_ lhs: [TodoBountyAllocation], _ rhs: [TodoBountyAllocation]) -> Bool {
        func signature(for allocations: [TodoBountyAllocation]) -> [String] {
            allocations
                .compactMap { allocation -> String? in
                    let pillarId = allocation.pillarId.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !pillarId.isEmpty else { return nil }
                    let points = max(0, allocation.points)
                    guard points > 0 else { return nil }
                    return "\(pillarId):\(points)"
                }
                .sorted()
        }

        return signature(for: lhs) == signature(for: rhs)
    }

    private func pointsIconSystemName(for todo: Todo) -> String {
        guard let firstPillarId = todo.allocationPillarIds.first else {
            return PillarIconRegistry.fallbackSystemName
        }
        let iconToken = pillarPickerSource.pillar(for: firstPillarId)?.iconToken
        return PillarIconRegistry.systemName(for: iconToken)
    }

    private func pointsIconColor(for todo: Todo) -> Color {
        guard let firstPillarId = todo.allocationPillarIds.first else {
            return S2.MyDay.Colors.subtitleText
        }
        return pillarPickerSource.pillar(for: firstPillarId)?.colorValue ?? S2.MyDay.Colors.subtitleText
    }

    private var settingsSummary: String {
        var sections: [String] = []

        switch (settings.includeScheduled, settings.includeUnscheduled) {
        case (true, true):
            sections.append("All dates")
        case (true, false):
            sections.append("Scheduled")
        case (false, true):
            sections.append("Unscheduled")
        case (false, false):
            sections.append("No dates")
        }

        if settings.includeCompleted {
            sections.append("Completed")
        }

        switch settings.pillarScope {
        case .all:
            break
        case .untagged:
            sections.append("Untagged")
        case .pillar(let pillarId):
            sections.append(pillarPickerSource.pillarName(for: pillarId) ?? "Pillar")
        }

        return sections.joined(separator: " · ")
    }

    private var emptyStateTitle: String {
        viewModel.todos.isEmpty ? "No todos yet." : "No todos match current settings."
    }

    private var emptyStateMessage: String {
        if viewModel.todos.isEmpty {
            return "Create one above. Scheduled and unscheduled todos both appear here."
        }

        if !settings.includeScheduled && !settings.includeUnscheduled {
            return "Turn on scheduled or unscheduled in Todo Settings."
        }

        return "Adjust Todo Settings to show more todos."
    }

    private func reloadTodosForCurrentUser() {
        guard let userId = firebaseManager.currentUser?.uid else { return }
        viewModel.loadTodos(userId: userId, includeCompleted: settings.includeCompleted)
    }
}

private struct TodoEditorSheet: View {
    let todo: Todo
    let pillars: [Pillar]
    let onSave: (String, String?, [TodoBountyAllocation], Bool) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var title: String
    @State private var pointsByPillarId: [String: Int]
    @State private var isScheduled: Bool
    @State private var selectedDate: Date

    init(
        todo: Todo,
        pillars: [Pillar],
        onSave: @escaping (String, String?, [TodoBountyAllocation], Bool) -> Void
    ) {
        self.todo = todo
        self.pillars = pillars
        self.onSave = onSave
        _title = State(initialValue: todo.content)
        var seededPoints: [String: Int] = [:]
        for allocation in todo.bountyAllocations ?? [] {
            let pillarId = allocation.pillarId.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !pillarId.isEmpty else { continue }
            seededPoints[pillarId] = max(0, min(100, allocation.points))
        }
        _pointsByPillarId = State(initialValue: seededPoints)
        _isScheduled = State(initialValue: todo.dueDate != nil)
        _selectedDate = State(initialValue: TodoDateCodec.date(from: todo.dueDate) ?? Date())
    }

    private var normalizedTitle: String {
        title.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var canSave: Bool {
        !normalizedTitle.isEmpty
    }

    private var normalizedAllocations: [TodoBountyAllocation] {
        pillars.compactMap { pillar in
            let points = pointsByPillarId[pillar.id] ?? 0
            guard points > 0 else { return nil }
            return TodoBountyAllocation(
                pillarId: pillar.id,
                points: max(0, min(100, points))
            )
        }
    }

    private var totalPoints: Int {
        normalizedAllocations.reduce(0) { $0 + $1.points }
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Title") {
                    TextField("What needs to get done?", text: $title)
                        .font(S2.MyDay.Typography.fieldValue)
                }

                Section("Points by Pillar") {
                    if pillars.isEmpty {
                        Text("No pillars available.")
                            .font(S2.MyDay.Typography.fieldLabel)
                            .foregroundColor(S2.MyDay.Colors.subtitleText)
                    } else {
                        ForEach(pillars) { pillar in
                            pointsRow(for: pillar)
                        }
                    }
                }

                Section("Schedule") {
                    Toggle(isOn: $isScheduled) {
                        Text("Schedule for a specific day")
                            .font(S2.MyDay.Typography.fieldValue)
                            .foregroundColor(S2.MyDay.Colors.titleText)
                    }
                    .tint(S2.MyDay.Colors.interactiveTint)

                    if isScheduled {
                        DatePicker(
                            "Date",
                            selection: $selectedDate,
                            displayedComponents: .date
                        )
                        .datePickerStyle(.graphical)
                        .tint(S2.MyDay.Colors.interactiveTint)
                    }
                }

                Section {
                    HStack {
                        Text("Total Points")
                            .font(S2.MyDay.Typography.fieldLabel)
                            .foregroundColor(S2.MyDay.Colors.subtitleText)
                        Spacer()
                        Text("\(totalPoints)/150")
                            .font(S2.MyDay.Typography.fieldValue)
                            .foregroundColor(S2.MyDay.Colors.titleText)
                    }
                }

                Section {
                    Button(role: .destructive) {
                        onSave(normalizedTitle, resolvedDueDate(), normalizedAllocations, true)
                        dismiss()
                    } label: {
                        Text("Delete Todo")
                    }
                }
            }
            .navigationTitle("Edit Todo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(normalizedTitle, resolvedDueDate(), normalizedAllocations, false)
                        dismiss()
                    }
                    .disabled(!canSave)
                }
            }
        }
    }

    private func resolvedDueDate() -> String? {
        isScheduled ? TodoDateCodec.storageString(from: selectedDate) : nil
    }

    private func pointsBinding(for pillarId: String) -> Binding<Int> {
        Binding<Int>(
            get: {
                pointsByPillarId[pillarId] ?? 0
            },
            set: { newValue in
                pointsByPillarId[pillarId] = max(0, min(100, newValue))
            }
        )
    }

    private func pointsRow(for pillar: Pillar) -> some View {
        let current = pointsBinding(for: pillar.id).wrappedValue
        let maxAllowed = max(0, min(100, current + (150 - totalPoints)))

        return HStack(spacing: S2.Spacing.sm) {
            Circle()
                .fill(pillar.colorValue)
                .frame(width: 10, height: 10)

            Text(pillar.name)
                .font(S2.MyDay.Typography.fieldValue)
                .foregroundColor(S2.MyDay.Colors.titleText)

            Spacer()

            Text("\(pointsBinding(for: pillar.id).wrappedValue) pts")
                .font(S2.MyDay.Typography.fieldLabel)
                .foregroundColor(S2.MyDay.Colors.subtitleText)

            Stepper(
                "",
                value: pointsBinding(for: pillar.id),
                in: 0...maxAllowed,
                step: 5
            )
            .labelsHidden()
            .tint(S2.MyDay.Colors.interactiveTint)
        }
    }
}

private enum TodoDateCodec {
    private static let storageFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let displayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = .current
        formatter.timeZone = .current
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    static func date(from raw: String?) -> Date? {
        guard let raw else { return nil }
        return storageFormatter.date(from: raw)
    }

    static func storageString(from date: Date) -> String {
        storageFormatter.string(from: date)
    }

    static func displayLabel(for raw: String?, unscheduled: String = "Unscheduled") -> String {
        guard let date = date(from: raw) else { return unscheduled }
        return displayFormatter.string(from: date)
    }
}

#Preview {
    TodoView()
        .environmentObject(FirebaseManager.shared)
}
