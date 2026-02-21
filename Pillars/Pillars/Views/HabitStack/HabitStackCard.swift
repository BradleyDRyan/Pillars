//
//  HabitStackCard.swift
//  Pillars
//
//  Full-card habit group renderer for Day rows.
//

import SwiftUI

struct HabitStackCard: View {
    let title: String
    let summary: String?
    let items: [DayViewModel.HabitStackItem]
    let onToggleHabit: (String, Bool) -> Void

    private var displayItems: [DayViewModel.HabitStackItem] {
        items.sorted {
            if $0.isCompleted != $1.isCompleted {
                return !$0.isCompleted
            }

            if $0.order != $1.order {
                return $0.order < $1.order
            }

            return $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
    }

    private var hasItems: Bool {
        !displayItems.isEmpty
    }

    private var completedCount: Int {
        displayItems.filter(\.isCompleted).count
    }

    private var totalCount: Int {
        displayItems.count
    }

    private var progress: CGFloat {
        guard totalCount > 0 else { return 0 }
        return CGFloat(completedCount) / CGFloat(totalCount)
    }

    private var summaryText: String {
        if let trimmedSummary = summary?.trimmingCharacters(in: .whitespacesAndNewlines),
           !trimmedSummary.isEmpty {
            return trimmedSummary
        }

        return "\(completedCount)/\(totalCount)"
    }

    var body: some View {
        CoreCardShell() {
            VStack(spacing: 0) {
                CoreCardRow(
                    leading: {
                        habitProgressRing
                    },
                    title: {
                        Text(title)
                            .font(S2.MyDay.Typography.blockTitle)
                            .foregroundColor(S2.MyDay.Colors.titleText)
                            .lineLimit(1)
                    },
                    subtitle: {
                        HStack(spacing: S2.MyDay.Spacing.compact) {
                            Text(summaryText)
                                .font(S2.MyDay.Typography.helper)
                                .foregroundColor(S2.MyDay.Colors.subtitleText)
                                .lineLimit(1)
                        }
                    }
                )

                Divider()
                    .overlay(S2.MyDay.Colors.divider)
                    .padding(.horizontal, S2.MyDay.Spacing.rowHorizontal)

                if !hasItems {
                    Text("No habits in this group yet.")
                        .font(S2.MyDay.Typography.emptyState)
                        .foregroundColor(S2.MyDay.Colors.subtitleText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, S2.MyDay.Spacing.rowHorizontal)
                        .padding(.vertical, S2.MyDay.Spacing.blockBody)
                } else {
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
                                        size: .compact,
                                        action: {
                                            onToggleHabit(item.habitId, !item.isCompleted)
                                        }
                                    )
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    private var habitProgressRing: some View {
        ZStack {
            Circle()
                .stroke(S2.MyDay.Colors.divider.opacity(0.7), lineWidth: 4)

            Circle()
                .trim(from: 0.0, to: progress)
                .stroke(
                    S2.Colors.primaryBrand,
                    style: StrokeStyle(lineWidth: 4, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut(duration: 0.2), value: progress)
                .opacity(totalCount == 0 ? 0 : 1)

            VStack(spacing: 2) {
                Text("\(completedCount)")
                    .font(S2.MyDay.Typography.blockSubtitle)
                    .foregroundColor(S2.MyDay.Colors.titleText)
                    .minimumScaleFactor(0.7)
                Text("of \(totalCount)")
                    .font(S2.MyDay.Typography.caption)
                    .foregroundColor(S2.MyDay.Colors.subtitleText)
            }
            .multilineTextAlignment(.center)
        }
        .frame(
            width: S2.MyDay.Icon.habitGroupProgressSize,
            height: S2.MyDay.Icon.habitGroupProgressSize
        )
    }
}
