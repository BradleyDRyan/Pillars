//
//  TaskList.swift
//  Squirrel2
//
//  Task list component showing scrollable list of tasks
//

import SwiftUI

struct TaskList: View {
    let tasks: [UserTask]
    let onTaskTap: (UserTask) -> Void

    private var pendingTasks: [UserTask] {
        tasks.filter { $0.status == .pending }
    }

    private var completedTasks: [UserTask] {
        tasks.filter { $0.status == .completed }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                // Pending tasks
                ForEach(pendingTasks) { task in
                    VStack(spacing: 0) {
                        TaskRow(task: task) {
                            onTaskTap(task)
                        }

                        // Divider between tasks
                        if task.id != pendingTasks.last?.id {
                            Divider()
                                .padding(.leading, 52)
                        }
                    }
                }

                // Completed tasks section (if any)
                if !completedTasks.isEmpty {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Completed")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(S2.Colors.secondaryText)
                            .padding(.horizontal, S2.Spacing.lg)
                            .padding(.vertical, S2.Spacing.sm)
                            .padding(.top, S2.Spacing.lg)

                        ForEach(completedTasks) { task in
                            VStack(spacing: 0) {
                                TaskRow(task: task) {
                                    onTaskTap(task)
                                }

                                // Divider between tasks
                                if task.id != completedTasks.last?.id {
                                    Divider()
                                        .padding(.leading, 52)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}