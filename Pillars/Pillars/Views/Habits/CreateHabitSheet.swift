//
//  CreateHabitSheet.swift
//  Pillars
//
//  Dedicated sheet for creating a customizable habit.
//

import SwiftUI

struct CreateHabitSheet: View {
    let initialTitle: String
    let habitGroups: [HabitGroup]
    let pillars: [Pillar]
    let onCreate: (HabitCreateInput) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var title: String
    @State private var selectedGroupId: String?
    @State private var newGroupName: String = ""
    @State private var scheduleType: HabitScheduleType = .daily
    @State private var selectedWeekdays: Set<HabitWeekday> = []
    @State private var targetType: HabitTargetType = .binary
    @State private var targetValueText: String = "1"
    @State private var targetUnit: String = ""
    @State private var selectedPillarId: String?

    init(
        initialTitle: String = "",
        habitGroups: [HabitGroup],
        pillars: [Pillar],
        onCreate: @escaping (HabitCreateInput) -> Void
    ) {
        self.initialTitle = initialTitle
        self.habitGroups = habitGroups
        self.pillars = pillars
        self.onCreate = onCreate

        _title = State(initialValue: initialTitle)
    }

    private var normalizedTitle: String {
        title.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var normalizedNewGroupName: String {
        newGroupName.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var normalizedTargetValue: Double? {
        let trimmed = targetValueText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return Double(trimmed)
    }

    private var canCreate: Bool {
        guard !normalizedTitle.isEmpty else { return false }

        if scheduleType == .weekly && selectedWeekdays.isEmpty {
            return false
        }

        if targetType != .binary {
            guard let value = normalizedTargetValue, value > 0 else { return false }
        }

        return true
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: S2.Spacing.md) {
                    fieldGroup("Title") {
                        TextField("What habit are you building?", text: $title)
                            .font(S2.MyDay.Typography.fieldValue)
                            .submitLabel(.done)
                            .s2MyDayInputSurface()
                    }

                    fieldGroup("Group") {
                        Picker("Group", selection: $selectedGroupId) {
                            Text("No Group").tag(String?.none)
                            ForEach(habitGroups) { group in
                                Text(group.name).tag(Optional(group.id))
                            }
                        }
                        .pickerStyle(.menu)
                        .font(S2.MyDay.Typography.fieldValue)

                        TextField("Create new group (optional)", text: $newGroupName)
                            .font(S2.MyDay.Typography.fieldValue)
                            .s2MyDayInputSurface()
                    }

                    fieldGroup("Schedule") {
                        Picker("Schedule", selection: $scheduleType) {
                            ForEach(HabitScheduleType.allCases) { type in
                                Text(type.displayName).tag(type)
                            }
                        }
                        .pickerStyle(.segmented)

                        if scheduleType == .weekly {
                            weekdaySelector
                        }
                    }

                    fieldGroup("Target") {
                        Picker("Target", selection: $targetType) {
                            ForEach(HabitTargetType.allCases) { type in
                                Text(type.displayName).tag(type)
                            }
                        }
                        .pickerStyle(.segmented)

                        if targetType != .binary {
                            HStack(spacing: S2.Spacing.sm) {
                                TextField("Target value", text: $targetValueText)
                                    .font(S2.MyDay.Typography.fieldValue)
                                    .keyboardType(.decimalPad)
                                    .s2MyDayInputSurface()

                                TextField("Unit (optional)", text: $targetUnit)
                                    .font(S2.MyDay.Typography.fieldValue)
                                    .s2MyDayInputSurface()
                            }
                        }
                    }

                    fieldGroup("Pillar") {
                        Picker("Pillar", selection: $selectedPillarId) {
                            Text("No Pillar").tag(String?.none)
                            ForEach(pillars) { pillar in
                                Text(pillar.name).tag(Optional(pillar.id))
                            }
                        }
                        .pickerStyle(.menu)
                        .font(S2.MyDay.Typography.fieldValue)
                    }
                }
                .padding(.horizontal, S2.MyDay.Spacing.pageHorizontal)
                .padding(.vertical, S2.MyDay.Spacing.pageVertical)
            }
            .background(S2.MyDay.Colors.pageBackground.ignoresSafeArea())
            .navigationTitle("Create Habit")
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
                        let input = HabitCreateInput(
                            title: normalizedTitle,
                            groupId: selectedGroupId,
                            newGroupName: normalizedNewGroupName.isEmpty ? nil : normalizedNewGroupName,
                            scheduleType: scheduleType,
                            daysOfWeek: selectedWeekdaysOrdered(),
                            targetType: targetType,
                            targetValue: targetType == .binary ? 1 : (normalizedTargetValue ?? 1),
                            targetUnit: targetType == .binary ? nil : targetUnit,
                            pillarId: selectedPillarId
                        )
                        print(
                            "📝 [Habits] Create tapped in sheet: "
                            + "title='\(input.title)', "
                            + "groupId=\(String(describing: input.groupId)), "
                            + "newGroupName=\(String(describing: input.newGroupName)), "
                            + "schedule=\(input.scheduleType.rawValue), "
                            + "targetType=\(input.targetType.rawValue), "
                            + "targetValue=\(input.targetValue), "
                            + "pillarId=\(String(describing: input.pillarId))"
                        )
                        onCreate(input)
                        dismiss()
                    }
                    .disabled(!canCreate)
                    .foregroundColor(
                        canCreate
                            ? S2.MyDay.Colors.interactiveTint
                            : S2.MyDay.Colors.subtitleText
                    )
                }
            }
        }
    }

    private func selectedWeekdaysOrdered() -> [HabitWeekday] {
        HabitWeekday.allCases.filter { selectedWeekdays.contains($0) }
    }

    private var weekdaySelector: some View {
        let columns = Array(repeating: GridItem(.flexible(), spacing: S2.Spacing.xs), count: 4)

        return LazyVGrid(columns: columns, spacing: S2.Spacing.xs) {
            ForEach(HabitWeekday.allCases) { day in
                let isSelected = selectedWeekdays.contains(day)

                Button {
                    if isSelected {
                        selectedWeekdays.remove(day)
                    } else {
                        selectedWeekdays.insert(day)
                    }
                } label: {
                    Text(day.shortLabel)
                        .font(S2.MyDay.Typography.fieldLabel)
                        .foregroundColor(isSelected ? S2.MyDay.Colors.sectionBackground : S2.MyDay.Colors.titleText)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, S2.Spacing.xs)
                        .background(isSelected ? S2.MyDay.Colors.interactiveTint : S2.MyDay.Colors.sectionBackground)
                        .clipShape(RoundedRectangle(cornerRadius: S2.CornerRadius.sm, style: .continuous))
                }
                .buttonStyle(.plain)
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
}
