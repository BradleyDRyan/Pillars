//
//  CreateTodoSheet.swift
//  Pillars
//
//  Dedicated sheet for creating a new todo.
//

import SwiftUI

struct CreateTodoSheet: View {
    let pillars: [Pillar]
    let onCreate: (String, String?, TodoAssignmentSelection) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var assignment: TodoAssignmentSelection = .auto
    @State private var isScheduled = false
    @State private var selectedDate = Date()

    private var normalizedTitle: String {
        title.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var canCreate: Bool {
        guard !normalizedTitle.isEmpty else { return false }
        if assignment.mode == .manual && assignment.pillarIds.isEmpty {
            return false
        }
        return true
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: S2.Spacing.md) {
                fieldGroup("Title") {
                    TextField("What needs to get done?", text: $title)
                        .font(S2.MyDay.Typography.fieldValue)
                        .submitLabel(.done)
                        .s2MyDayInputSurface()
                }

                fieldGroup("Assignment") {
                    VStack(spacing: S2.Spacing.xs) {
                        assignmentRow(
                            title: "Auto",
                            subtitle: "Let classifier pick the best pillar matches.",
                            isSelected: assignment.mode == .auto,
                            color: S2.MyDay.Colors.interactiveTint
                        ) {
                            assignment = .auto
                        }

                        ForEach(pillars) { pillar in
                            let isSelected = assignment.mode == .manual && assignment.pillarIds.contains(pillar.id)
                            assignmentRow(
                                title: pillar.name,
                                subtitle: nil,
                                isSelected: isSelected,
                                color: pillar.colorValue
                            ) {
                                toggleManualSelection(pillar.id)
                            }
                        }
                    }
                }

                fieldGroup("Schedule") {
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

                Spacer()
            }
            .padding(.horizontal, S2.MyDay.Spacing.pageHorizontal)
            .padding(.vertical, S2.MyDay.Spacing.pageVertical)
            .background(S2.MyDay.Colors.pageBackground.ignoresSafeArea())
            .navigationTitle("Create Todo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(S2.MyDay.Colors.subtitleText)
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        onCreate(
                            normalizedTitle,
                            isScheduled ? dueDateString(from: selectedDate) : nil,
                            normalizedAssignment()
                        )
                        dismiss()
                    }
                    .disabled(!canCreate)
                    .foregroundColor(
                        !canCreate
                            ? S2.MyDay.Colors.subtitleText
                            : S2.MyDay.Colors.interactiveTint
                    )
                }
            }
        }
    }

    @ViewBuilder
    private func fieldGroup<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: S2.Spacing.sm) {
            Text(title)
                .font(S2.MyDay.Typography.fieldLabel)
                .foregroundColor(S2.MyDay.Colors.subtitleText)

            content()
        }
    }

    private func toggleManualSelection(_ pillarId: String) {
        let normalized = pillarId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return }

        var selected = assignment.pillarIds
        if let index = selected.firstIndex(of: normalized) {
            selected.remove(at: index)
        } else {
            selected.append(normalized)
        }

        if selected.isEmpty {
            assignment = .auto
        } else {
            assignment = .manual(selected)
        }
    }

    private func normalizedAssignment() -> TodoAssignmentSelection {
        if assignment.mode == .manual && !assignment.pillarIds.isEmpty {
            return .manual(assignment.pillarIds)
        }
        return .auto
    }

    private func assignmentRow(
        title: String,
        subtitle: String?,
        isSelected: Bool,
        color: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: S2.Spacing.sm) {
                Circle()
                    .fill(color)
                    .frame(width: 10, height: 10)

                VStack(alignment: .leading, spacing: S2.Spacing.xs) {
                    Text(title)
                        .font(S2.MyDay.Typography.fieldValue)
                        .foregroundColor(S2.MyDay.Colors.titleText)
                    if let subtitle {
                        Text(subtitle)
                            .font(S2.MyDay.Typography.fieldLabel)
                            .foregroundColor(S2.MyDay.Colors.subtitleText)
                    }
                }

                Spacer()

                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(S2.MyDay.Colors.interactiveTint)
                }
            }
            .padding(.horizontal, S2.Spacing.sm)
            .padding(.vertical, S2.Spacing.sm)
            .background(S2.MyDay.Colors.sectionBackground)
            .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.sm, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func dueDateString(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}
