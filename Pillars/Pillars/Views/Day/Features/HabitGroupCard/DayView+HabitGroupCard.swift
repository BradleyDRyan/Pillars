//
//  DayView+HabitGroupCard.swift
//  Pillars
//
//  Habit-group card action helpers and sheet routing.
//

import SwiftUI

extension DayView {
    struct HabitGroupCardSheetTarget: Identifiable {
        let id: String
    }

    func presentHabitGroupCard(blockId: String) {
        selectedHabitGroupCard = HabitGroupCardSheetTarget(id: blockId)
    }

    @ViewBuilder
    func habitGroupCardSheetContent(target: HabitGroupCardSheetTarget) -> some View {
        if let block = blockValue(for: target.id),
           isHabitGroupCardBlock(block) {
            let items = habitGroupCardItems(for: block)
            let summary = habitGroupCardSummary(block, items: items)

            if !items.isEmpty {
                HabitGroupCardDetailSheet(
                    title: summary.title,
                    items: items
                ) { habitId, isCompleted in
                    withAnimation(dayEntryTransferAnimation) {
                        viewModel.setHabitCompletion(habitId: habitId, isCompleted: isCompleted)
                    }
                }
            } else {
                NavigationStack {
                    VStack {
                        Text("This habit group is empty.")
                            .font(S2.MyDay.Typography.emptyState)
                            .foregroundColor(S2.MyDay.Colors.subtitleText)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(S2.MyDay.Spacing.pageVertical)
                    .background(S2.MyDay.Colors.pageBackground)
                    .navigationTitle(summary.title)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Done") {
                                selectedHabitGroupCard = nil
                            }
                            .font(S2.MyDay.Typography.helper)
                        }
                    }
                }
            }
        } else {
            NavigationStack {
                VStack {
                    Text("This habit group is unavailable.")
                        .font(S2.MyDay.Typography.emptyState)
                        .foregroundColor(S2.MyDay.Colors.subtitleText)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(S2.MyDay.Spacing.pageVertical)
                .background(S2.MyDay.Colors.pageBackground)
                .navigationTitle("Habit Group")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Done") {
                            selectedHabitGroupCard = nil
                        }
                        .font(S2.MyDay.Typography.helper)
                    }
                }
            }
        }
    }

    func blockValue(for blockId: String) -> Block? {
        guard let day = viewModel.day else { return nil }
        for section in day.sections {
            if let block = section.blocks.first(where: { $0.id == blockId }) {
                return block
            }
        }
        return nil
    }
}
