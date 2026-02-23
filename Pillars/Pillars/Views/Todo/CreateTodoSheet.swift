//
//  CreateTodoSheet.swift
//  Pillars
//
//  Dedicated sheet for creating a new todo.
//

import SwiftUI

struct CreateTodoSheet: View {
    let pillars: [Pillar]
    let onCreate: (String, String?, String?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var selectedPillarId: String?
    @State private var isScheduled = false
    @State private var selectedDate = Date()

    private var normalizedTitle: String {
        title.trimmingCharacters(in: .whitespacesAndNewlines)
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
                            selectedPillarId
                        )
                        dismiss()
                    }
                    .disabled(normalizedTitle.isEmpty)
                    .foregroundColor(
                        normalizedTitle.isEmpty
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

    private func dueDateString(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}
