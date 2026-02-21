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
    @State private var pillarPickerTarget: Todo?
    @State private var schedulePickerTarget: Todo?
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
        .sheet(item: $pillarPickerTarget) { target in
            PillarPickerSheet(
                title: "Retag Todo",
                pillars: pillarPickerSource.pillars,
                selectedPillarId: target.pillarId
            ) { selectedPillarId in
                viewModel.setTodoPillar(todoId: target.id, pillarId: selectedPillarId)
            }
        }
        .sheet(item: $schedulePickerTarget) { target in
            TodoScheduleSheet(
                title: "Schedule Todo",
                initialDueDate: target.dueDate
            ) { dueDate in
                viewModel.setTodoDueDate(todoId: target.id, dueDate: dueDate)
            }
        }
        .sheet(isPresented: $showingCreateTodoSheet) {
            CreateTodoSheet { title, dueDate in
                viewModel.createTodo(title: title, dueDate: dueDate)
            }
        }
        .sheet(isPresented: $showingSettingsSheet) {
            TodoViewSettingsSheet(
                settings: $settings,
                pillars: pillarPickerSource.pillars
            )
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

        return ListRow(swipeDelete: { viewModel.deleteTodo(todoId: entry.id) }) {
            EmptyView()
        } title: {
            Text(entry.content)
                .font(S2.MyDay.Typography.fieldValue)
                .foregroundColor(completed ? S2.MyDay.Colors.subtitleText : S2.MyDay.Colors.titleText)
                .strikethrough(completed, color: S2.MyDay.Colors.subtitleText)
                .frame(maxWidth: .infinity, alignment: .leading)
        } subtitle: {
            Text(scheduleLabel(for: entry.dueDate))
                .font(S2.MyDay.Typography.fieldLabel)
                .foregroundColor(S2.MyDay.Colors.subtitleText)
        } trailing: {
            HStack(spacing: S2.Spacing.xs) {
                if let bounty = bountyLabel(entry) {
                    HStack(spacing: 6) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 12, weight: .semibold))
                        Text(bounty)
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundColor(S2.MyDay.Colors.titleText)
                    .padding(.horizontal, S2.Spacing.sm)
                    .padding(.vertical, S2.Spacing.xs)
                    .background(S2.MyDay.Colors.sectionBackground.opacity(0.9))
                    .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.md, style: .continuous))
                }

                PillarTagChip(
                    title: pillarLabel(for: entry.pillarId),
                    color: pillarColor(for: entry.pillarId)
                )

                Button {
                    schedulePickerTarget = entry
                } label: {
                    Image(systemName: "calendar")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(S2.MyDay.Colors.subtitleText)
                        .padding(6)
                        .background(S2.MyDay.Colors.sectionBackground)
                        .clipShape(Circle())
                }
                    .buttonStyle(.plain)

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
                    isCompleted: completed,
                    size: .compact,
                    action: {
                        toggleTodo(entry)
                    }
                )
            }
        }
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
                return item.pillarId == nil
            case .pillar(let pillarId):
                return item.pillarId == pillarId
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

    private func scheduleLabel(for dueDate: String?) -> String {
        if let dueDate {
            return "Scheduled \(TodoDateCodec.displayLabel(for: dueDate))"
        }
        return "Unscheduled"
    }

    private func bountyLabel(_ todo: Todo) -> String? {
        guard let points = todo.bountyPoints, points > 0 else { return nil }
        return "+\(points)"
    }

    private func toggleTodo(_ entry: Todo) {
        viewModel.setTodoCompletion(todoId: entry.id, isCompleted: !entry.isCompleted)
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

private struct TodoScheduleSheet: View {
    let title: String
    let initialDueDate: String?
    let onSave: (String?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var isScheduled: Bool
    @State private var selectedDate: Date

    init(title: String, initialDueDate: String?, onSave: @escaping (String?) -> Void) {
        self.title = title
        self.initialDueDate = initialDueDate
        self.onSave = onSave

        let parsedDate = TodoDateCodec.date(from: initialDueDate) ?? Date()
        _isScheduled = State(initialValue: initialDueDate != nil)
        _selectedDate = State(initialValue: parsedDate)
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: S2.Spacing.md) {
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

                Spacer()
            }
            .padding(.horizontal, S2.MyDay.Spacing.pageHorizontal)
            .padding(.vertical, S2.MyDay.Spacing.pageVertical)
            .background(S2.MyDay.Colors.pageBackground.ignoresSafeArea())
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(S2.MyDay.Colors.subtitleText)
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let dueDate = isScheduled ? TodoDateCodec.storageString(from: selectedDate) : nil
                        onSave(dueDate)
                        dismiss()
                    }
                    .foregroundColor(S2.MyDay.Colors.interactiveTint)
                }
            }
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
