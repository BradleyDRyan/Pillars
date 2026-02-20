//
//  TodoViewSettingsSheet.swift
//  Pillars
//
//  Todo surface settings sheet for visibility controls.
//

import SwiftUI

enum TodoPillarScope: Equatable {
    case all
    case untagged
    case pillar(String)
}

struct TodoViewSettings: Equatable {
    var includeScheduled = true
    var includeUnscheduled = true
    var includeCompleted = false
    var pillarScope: TodoPillarScope = .all
}

struct TodoViewSettingsSheet: View {
    @Binding var settings: TodoViewSettings
    let pillars: [Pillar]

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: S2.MyDay.Spacing.sectionStack) {
                    visibilitySection
                    pillarSection

                    if !settings.includeScheduled && !settings.includeUnscheduled {
                        Text("Scheduled and unscheduled are both off, so no todos will appear.")
                            .font(S2.MyDay.Typography.fieldLabel)
                            .foregroundColor(S2.MyDay.Colors.subtitleText)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(.horizontal, S2.MyDay.Spacing.pageHorizontal)
                .padding(.vertical, S2.MyDay.Spacing.pageVertical)
            }
            .background(S2.MyDay.Colors.pageBackground)
            .navigationTitle("Todo Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Reset") {
                        settings = TodoViewSettings()
                    }
                    .foregroundColor(S2.MyDay.Colors.subtitleText)
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundColor(S2.MyDay.Colors.interactiveTint)
                }
            }
        }
    }

    private var visibilitySection: some View {
        VStack(alignment: .leading, spacing: S2.Spacing.sm) {
            Text("Visibility")
                .font(S2.MyDay.Typography.fieldLabel)
                .foregroundColor(S2.MyDay.Colors.subtitleText)

            VStack(spacing: S2.Spacing.none) {
                settingsToggle(title: "Show scheduled", isOn: $settings.includeScheduled)
                rowDivider
                settingsToggle(title: "Show unscheduled", isOn: $settings.includeUnscheduled)
                rowDivider
                settingsToggle(title: "Show completed", isOn: $settings.includeCompleted)
            }
            .s2MyDaySectionCard()
        }
    }

    private var pillarSection: some View {
        VStack(alignment: .leading, spacing: S2.Spacing.sm) {
            Text("Pillar")
                .font(S2.MyDay.Typography.fieldLabel)
                .foregroundColor(S2.MyDay.Colors.subtitleText)

            Menu {
                Button("All") {
                    settings.pillarScope = .all
                }
                Button("Untagged") {
                    settings.pillarScope = .untagged
                }

                if !pillars.isEmpty {
                    Divider()
                    ForEach(pillars) { pillar in
                        Button(pillar.name) {
                            settings.pillarScope = .pillar(pillar.id)
                        }
                    }
                }
            } label: {
                HStack(spacing: S2.Spacing.xs) {
                    Text(currentPillarLabel)
                        .font(S2.MyDay.Typography.fieldValue)
                        .foregroundColor(S2.MyDay.Colors.titleText)
                    Spacer()
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.system(size: S2.MyDay.Icon.actionSize, weight: .semibold))
                        .foregroundColor(S2.MyDay.Colors.subtitleText)
                }
                .padding(.horizontal, S2.Spacing.sm)
                .padding(.vertical, S2.Spacing.sm)
                .s2MyDayInputSurface(padding: S2.Spacing.none)
            }
            .buttonStyle(.plain)
        }
        .s2MyDaySectionCard()
    }

    private var rowDivider: some View {
        Rectangle()
            .fill(S2.MyDay.Colors.divider)
            .frame(height: 1)
    }

    private func settingsToggle(title: String, isOn: Binding<Bool>) -> some View {
        Toggle(isOn: isOn) {
            Text(title)
                .font(S2.MyDay.Typography.fieldValue)
                .foregroundColor(S2.MyDay.Colors.titleText)
        }
        .tint(S2.MyDay.Colors.interactiveTint)
        .padding(.horizontal, S2.Spacing.sm)
        .padding(.vertical, S2.Spacing.sm)
    }

    private var currentPillarLabel: String {
        switch settings.pillarScope {
        case .all:
            return "All"
        case .untagged:
            return "Untagged"
        case .pillar(let pillarId):
            return pillars.first(where: { $0.id == pillarId })?.name ?? "Pillar"
        }
    }
}
