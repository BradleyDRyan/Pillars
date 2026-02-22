//
//  HabitGroupCardDetailSheet.swift
//  Pillars
//
//  Detail sheet that expands a habit group into its individual habit rows.
//

import SwiftUI

struct HabitGroupCardDetailSheet: View {
    let title: String
    let items: [DayViewModel.HabitStackItem]
    let onToggleHabit: (String, Bool) -> Void

    @Environment(\.dismiss) private var dismiss

    private var displayItems: [DayViewModel.HabitStackItem] {
        let sorted = items.sorted {
            if $0.isCompleted != $1.isCompleted {
                return !$0.isCompleted
            }
            if $0.order != $1.order {
                return $0.order < $1.order
            }
            return $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
        return sorted
    }

    private var completedCount: Int {
        items.filter(\.isCompleted).count
    }

    private var totalCount: Int {
        items.count
    }

    private var summaryText: String {
        "\(completedCount) of \(totalCount) completed"
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: S2.MyDay.Spacing.sectionContent) {
                HStack(spacing: S2.MyDay.Spacing.blockHeader) {
                    Text(summaryText)
                        .font(S2.MyDay.Typography.helper)
                        .foregroundColor(S2.MyDay.Colors.subtitleText)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    HabitGroupProgressIndicator(
                        completed: completedCount,
                        total: totalCount
                    )
                }

                Divider()
                    .overlay(S2.MyDay.Colors.divider)

                if items.isEmpty {
                    Text("No habits in this group yet.")
                        .font(S2.MyDay.Typography.emptyState)
                        .foregroundColor(S2.MyDay.Colors.subtitleText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, S2.MyDay.Spacing.blockBody)
                } else {
                    ScrollView {
                        VStack(spacing: 0) {
                            ForEach(Array(displayItems.enumerated()), id: \.element.habitId) { index, item in
                                ListRow(
                                    showDivider: index < displayItems.count - 1,
                                    horizontalPadding: S2.MyDay.Spacing.rowHorizontal,
                                    verticalPadding: S2.MyDay.Spacing.blockBody,
                                    leading: {
                                        EmptyView()
                                    },
                                    title: {
                                        Text(item.name)
                                            .font(S2.MyDay.Typography.blockTitle)
                                            .foregroundColor(item.isCompleted ? S2.MyDay.Colors.subtitleText : S2.MyDay.Colors.titleText)
                                            .strikethrough(item.isCompleted, color: S2.MyDay.Colors.subtitleText)
                                            .lineLimit(2)
                                    },
                                    subtitle: {
                                        EmptyView()
                                    },
                                    trailing: {
                                        S2MyDayDoneIconButton(
                                            isCompleted: item.isCompleted,
                                            size: .compact
                                        ) {
                                            onToggleHabit(item.habitId, !item.isCompleted)
                                        }
                                    }
                                )
                            }
                        }
                    }
                }

                Spacer()
            }
            .padding(.horizontal, S2.MyDay.Spacing.pageHorizontal)
            .padding(.vertical, S2.MyDay.Spacing.pageVertical)
            .background(S2.MyDay.Colors.pageBackground)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .font(S2.MyDay.Typography.helper)
                }
            }
        }
    }
}
