//
//  PillarPickerSheet.swift
//  Pillars
//
//  Reusable sheet for selecting a pillar tag.
//

import SwiftUI

struct PillarPickerSheet: View {
    let title: String
    let pillars: [Pillar]
    let selectedPillarId: String?
    let onSelect: (String?) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    selectionRow(
                        label: "No Pillar",
                        isSelected: selectedPillarId == nil,
                        chip: {
                            PillarTagChip(
                                title: "No Pillar",
                                color: S2.MyDay.Colors.subtitleText
                            )
                        }
                    ) {
                        onSelect(nil)
                    }
                }

                if !pillars.isEmpty {
                    Section("Pillars") {
                        ForEach(pillars) { pillar in
                            selectionRow(
                                label: pillar.name,
                                isSelected: selectedPillarId == pillar.id,
                                chip: {
                                    PillarTagChip(title: pillar.name, color: pillar.colorValue)
                                }
                            ) {
                                onSelect(pillar.id)
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private func selectionRow<Chip: View>(
        label: String,
        isSelected: Bool,
        @ViewBuilder chip: () -> Chip,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            action()
            dismiss()
        } label: {
            HStack(spacing: S2.Spacing.sm) {
                chip()
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(S2.MyDay.Colors.interactiveTint)
                        .accessibilityLabel("\(label) selected")
                }
            }
        }
        .buttonStyle(.plain)
    }
}
