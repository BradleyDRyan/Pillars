//
//  HabitGroupCard.swift
//  Pillars
//
//  Compact day-row representation of a habit group card.
//

import SwiftUI

struct HabitGroupCard: View {
    let title: String
    let summary: String?
    let items: [DayViewModel.HabitStackItem]
    let onDelete: (() -> Void)?
    let onTap: (() -> Void)?

    private var completedCount: Int {
        items.filter(\.isCompleted).count
    }

    private var totalCount: Int {
        items.count
    }

    private var summaryText: String {
        if let trimmedSummary = summary?.trimmingCharacters(in: .whitespacesAndNewlines),
           !trimmedSummary.isEmpty {
            return trimmedSummary
        }

        return "\(completedCount)/\(totalCount)"
    }

    var body: some View {
        CoreCardShell(onDelete: onDelete, onTap: onTap) {
            CoreCardRow(
                leading: {
                    EmptyView()
                },
                title: {
                    Text(title)
                        .font(S2.MyDay.Typography.blockTitle)
                        .foregroundColor(S2.MyDay.Colors.titleText)
                        .lineLimit(1)
                },
                subtitle: {
                    Text(summaryText)
                        .font(S2.MyDay.Typography.blockSubtitle)
                        .foregroundColor(S2.MyDay.Colors.subtitleText)
                        .lineLimit(1)
                },
                trailing: {
                    HabitGroupProgressIndicator(
                        completed: completedCount,
                        total: totalCount
                    )
                }
            )
        }
    }
}

struct HabitGroupProgressIndicator: View {
    let completed: Int
    let total: Int

    private var progress: CGFloat {
        guard total > 0 else { return 0 }
        return CGFloat(completed) / CGFloat(total)
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(
                    S2.MyDay.Colors.divider.opacity(0.7),
                    lineWidth: 4
                )

            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    S2.Colors.primaryBrand,
                    style: StrokeStyle(lineWidth: 4, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut(duration: 0.2), value: progress)
                .opacity(total == 0 ? 0 : 1)

            if total > 0 {
                Text("\(completed)")
                    .font(S2.MyDay.Typography.blockSubtitle)
                    .foregroundColor(S2.MyDay.Colors.titleText)
                    .minimumScaleFactor(0.75)
            }
        }
        .frame(
            width: S2.MyDay.Icon.habitGroupProgressSize,
            height: S2.MyDay.Icon.habitGroupProgressSize
        )
    }
}
