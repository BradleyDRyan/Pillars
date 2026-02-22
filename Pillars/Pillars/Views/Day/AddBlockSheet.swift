//
//  AddBlockSheet.swift
//  Pillars
//
//  Sheet for selecting a built-in or custom block type
//

import SwiftUI
import UIKit

struct AddBlockSheet: View {
    let builtIns: [BlockType]
    let customTypes: [BlockType]
    let onSelect: (_ typeId: String, _ customType: BlockType?) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                let selectableBuiltIns = builtIns.filter {
                    $0.id != "habit-stack" && $0.id != "habit-group-card"
                }

                Section {
                    ForEach(selectableBuiltIns) { type in
                        row(
                            icon: type.icon,
                            title: type.name,
                            description: type.description
                        ) {
                            onSelect(type.id, nil)
                            dismiss()
                        }
                    }
                } header: {
                    Text("Built-in")
                        .font(S2.MyDay.Typography.helper)
                        .foregroundColor(S2.MyDay.Colors.subtitleText)
                }

                if !customTypes.isEmpty {
                    Section {
                        ForEach(customTypes) { type in
                            row(
                                icon: type.icon,
                                title: type.name,
                                description: type.subtitleTemplate.isEmpty ? "Custom block type." : type.subtitleTemplate
                            ) {
                                onSelect(type.id, type)
                                dismiss()
                            }
                        }
                    } header: {
                        Text("Custom")
                            .font(S2.MyDay.Typography.helper)
                            .foregroundColor(S2.MyDay.Colors.subtitleText)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(S2.MyDay.Colors.pageBackground)
            .navigationTitle("Add Block")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") { dismiss() }
                        .font(S2.MyDay.Typography.helper)
                }
            }
        }
    }

    private func row(
        icon: String,
        title: String,
        description: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: S2.MyDay.Spacing.blockHeader) {
                iconBadge(for: icon)

                VStack(alignment: .leading, spacing: S2.MyDay.Spacing.compact) {
                    Text(title)
                        .font(S2.MyDay.Typography.blockTitle)
                        .foregroundColor(S2.MyDay.Colors.titleText)

                    Text(description)
                        .font(S2.MyDay.Typography.blockSubtitle)
                        .foregroundColor(S2.MyDay.Colors.subtitleText)
                        .lineLimit(2)
                }

                Spacer()

                Image(systemName: "plus")
                    .font(.system(size: S2.MyDay.Icon.actionSize, weight: .semibold))
                    .foregroundColor(S2.MyDay.Colors.subtitleText)
            }
            .padding(.vertical, S2.Spacing.xs)
        }
        .buttonStyle(.plain)
        .listRowBackground(S2.MyDay.Colors.sectionBackground)
    }

    @ViewBuilder
    private func iconBadge(for icon: String) -> some View {
        let resolvedIcon = BlockIcon.resolvedSystemSymbol(from: icon)

        if UIImage(systemName: resolvedIcon) != nil {
            S2MyDayIconBadge(systemName: resolvedIcon)
        } else {
            Text(resolvedIcon)
                .font(.system(size: S2.MyDay.Icon.smallSize))
                .frame(width: S2.MyDay.Icon.badgeSize, height: S2.MyDay.Icon.badgeSize)
                .background(
                    RoundedRectangle(cornerRadius: S2.CornerRadius.sm, style: .continuous)
                        .fill(S2.MyDay.Colors.iconBackground)
                )
        }
    }
}
