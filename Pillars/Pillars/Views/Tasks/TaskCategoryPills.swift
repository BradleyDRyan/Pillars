//
//  TaskCategoryPills.swift
//  Squirrel2
//
//  Category filter pills for tasks
//

import SwiftUI

enum TaskFilter: String, CaseIterable {
    case all = "All"
    case today = "Today"
    case upcoming = "Upcoming"
    case completed = "Completed"
    case high = "High Priority"
}

struct TaskCategoryPills: View {
    @Binding var selectedFilter: TaskFilter
    let taskCounts: [TaskFilter: Int]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(TaskFilter.allCases, id: \.self) { filter in
                    let count = taskCounts[filter] ?? 0
                    // Only show filter if it has tasks or is "All"
                    if count > 0 || filter == .all {
                        CategoryPill(
                            title: filter.rawValue,
                            count: count,
                            isSelected: selectedFilter == filter
                        ) {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                selectedFilter = filter
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, S2.Spacing.lg)
        }
    }
}

struct CategoryPill: View {
    let title: String
    let count: Int
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text(title)
                    .font(.system(size: 13, weight: .medium))

                if count > 0 && !isSelected {
                    Text("(\(count))")
                        .font(.system(size: 12, weight: .regular))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .frame(minHeight: 36)
            .background(isSelected ? S2.Colors.primaryBrand : S2.Colors.tinted)
            .foregroundColor(isSelected ? .white : S2.Colors.primaryText)
            .cornerRadius(18)
        }
    }
}
