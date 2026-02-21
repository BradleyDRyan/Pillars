//
//  ChecklistBlockView.swift
//  Pillars
//
//  Generic block view for checklist data (habits, todos)
//

import SwiftUI

struct ChecklistBlockView: View {
    enum Mode {
        case standard
        case todo
        case habit
    }

    @Binding var data: ChecklistData
    var mode: Mode = .standard
    @State private var newItemText = ""
    @FocusState private var isAddFieldFocused: Bool

    var body: some View {
        Group {
            switch mode {
            case .standard:
                standardChecklistBody
            case .todo:
                todoChecklistBody
                    .onAppear(perform: ensureTodoTitleExists)
            case .habit:
                habitChecklistBody
                    .onAppear(perform: ensureHabitItemExists)
            }
        }
    }

    private var standardChecklistBody: some View {
        VStack(spacing: S2.Spacing.xs) {
            ForEach($data.items) { $item in
                checklistRow(item: $item, placeholder: "Item") {
                    withAnimation(.easeInOut(duration: 0.15)) {
                        data.items.removeAll { $0.id == item.id }
                    }
                }
            }

            addItemRow(placeholder: "Add item…", onCommit: commitNewItem)
        }
    }

    private var checklistCompletedIconName: String {
        switch mode {
        case .standard:
            return "seal.fill"
        case .todo, .habit:
            return "checkmark"
        }
    }

    private var checklistIncompleteIconName: String {
        switch mode {
        case .standard:
            return "seal"
        case .todo, .habit:
            return "checkmark"
        }
    }

    private var todoChecklistBody: some View {
        VStack(alignment: .leading, spacing: S2.Spacing.sm) {
            VStack(alignment: .leading, spacing: S2.Spacing.xs) {
                Text("Task")
                    .font(S2.MyDay.Typography.fieldLabel)
                    .foregroundColor(S2.MyDay.Colors.subtitleText)

                checklistRow(item: todoTitleBinding, placeholder: "Todo title", showDelete: false)
            }

            if !todoSubtaskIndices.isEmpty {
                Text("Subtasks")
                    .font(S2.MyDay.Typography.fieldLabel)
                    .foregroundColor(S2.MyDay.Colors.subtitleText)
            }

            ForEach(todoSubtaskIndices, id: \.self) { (index: Int) in
                let subtaskId = data.items[index].id
                checklistRow(item: $data.items[index], placeholder: "Subtask") {
                    withAnimation(.easeInOut(duration: 0.15)) {
                        data.items.removeAll { $0.id == subtaskId }
                    }
                }
            }

            addItemRow(placeholder: "Add subtask…", onCommit: commitNewItem)
        }
    }

    private var habitChecklistBody: some View {
        VStack(alignment: .leading, spacing: S2.Spacing.xs) {
            Text("Habit")
                .font(S2.MyDay.Typography.fieldLabel)
                .foregroundColor(S2.MyDay.Colors.subtitleText)

            checklistRow(item: habitItemBinding, placeholder: "Habit", showDelete: false)
        }
    }

    private func checklistRow(
        item: Binding<ChecklistItem>,
        placeholder: String,
        showDelete: Bool = true,
        onDelete: (() -> Void)? = nil
    ) -> some View {
        ListRow(
            horizontalPadding: 0,
            verticalPadding: S2.MyDay.Spacing.emptyStateVertical
        ) {
            EmptyView()
        } title: {
            TextField(placeholder, text: item.title)
                .font(S2.MyDay.Typography.fieldValue)
                .strikethrough(item.wrappedValue.isCompleted, color: S2.MyDay.Colors.subtitleText)
                .foregroundColor(item.wrappedValue.isCompleted ? S2.MyDay.Colors.subtitleText : S2.MyDay.Colors.titleText)
        } subtitle: {
            EmptyView()
        } trailing: {
            HStack(spacing: S2.MyDay.Spacing.compact) {
                S2MyDayDoneIconButton(
                    isCompleted: item.wrappedValue.isCompleted,
                    size: .compact,
                    completedIconName: checklistCompletedIconName,
                    incompleteIconName: checklistIncompleteIconName
                ) {
                    item.wrappedValue.isCompleted.toggle()
                }

                trailingDeleteButton(showDelete: showDelete, onDelete: onDelete)
            }
        }
    }

    @ViewBuilder
    private func trailingDeleteButton(showDelete: Bool, onDelete: (() -> Void)?) -> some View {
        if showDelete {
            Button {
                onDelete?()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(S2.MyDay.Colors.disabledIcon)
            }
            .buttonStyle(.plain)
        }
    }

    private func addItemRow(placeholder: String, onCommit: @escaping () -> Void) -> some View {
        HStack(spacing: S2.Spacing.md) {
            Image(systemName: "plus.circle")
                .font(.system(size: S2.MyDay.Icon.checklistSize))
                .foregroundColor(S2.MyDay.Colors.interactiveTint.opacity(0.75))

            TextField(placeholder, text: $newItemText)
                .font(S2.MyDay.Typography.fieldValue)
                .foregroundColor(S2.MyDay.Colors.titleText)
                .focused($isAddFieldFocused)
                .onSubmit { onCommit() }

            if !newItemText.isEmpty {
                Button { onCommit() } label: {
                    Image(systemName: "return")
                        .font(.system(size: 14))
                        .foregroundColor(S2.MyDay.Colors.interactiveTint)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, S2.Spacing.xs)
    }

    private var todoTitleBinding: Binding<ChecklistItem> {
        Binding(
            get: {
                if let existing = data.items.first {
                    return existing
                }
                return ChecklistItem(id: "todo-title-temp", title: "", isCompleted: false)
            },
            set: { updated in
                if data.items.isEmpty {
                    data.items = [
                        ChecklistItem(
                            id: updated.id == "todo-title-temp" ? UUID().uuidString : updated.id,
                            title: updated.title,
                            isCompleted: updated.isCompleted
                        )
                    ]
                    return
                }
                data.items[0] = updated
            }
        )
    }

    private var todoSubtaskIndices: [Int] {
        Array(data.items.indices.dropFirst())
    }

    private var habitItemBinding: Binding<ChecklistItem> {
        Binding(
            get: {
                if let existing = data.items.first {
                    return existing
                }
                return ChecklistItem(id: "habit-item-temp", title: "", isCompleted: false)
            },
            set: { updated in
                let normalizedId = updated.id == "habit-item-temp" ? UUID().uuidString : updated.id
                let normalized = ChecklistItem(id: normalizedId, title: updated.title, isCompleted: updated.isCompleted)

                if data.items.isEmpty {
                    data.items = [normalized]
                    return
                }

                data.items[0] = normalized
                if data.items.count > 1 {
                    data.items = [data.items[0]]
                }
            }
        )
    }

    private func ensureTodoTitleExists() {
        guard data.items.isEmpty else { return }
        data.items = [ChecklistItem(id: UUID().uuidString, title: "", isCompleted: false)]
    }

    private func ensureHabitItemExists() {
        if data.items.isEmpty {
            data.items = [ChecklistItem(id: UUID().uuidString, title: "", isCompleted: false)]
            return
        }

        if data.items.count > 1, let first = data.items.first {
            data.items = [first]
        }
    }

    private func commitNewItem() {
        let trimmed = newItemText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        withAnimation(.easeInOut(duration: 0.2)) {
            data.items.append(ChecklistItem(id: UUID().uuidString, title: trimmed, isCompleted: false))
        }
        newItemText = ""
    }
}
