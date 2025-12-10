//
//  TaskDetailView.swift
//  Squirrel2
//
//  Detailed view for a single task - Refactored with modular components
//

import SwiftUI

struct TaskDetailView: View {
    let taskId: String
    @ObservedObject var viewModel: TasksViewModel
    @Environment(\.dismiss) var dismiss
    @State private var isGeneratingSubtasks = false
    @State private var showEditSheet = false

    // Computed property to always get the latest task from viewModel
    var task: UserTask {
        viewModel.tasks.first(where: { $0.id == taskId }) ?? UserTask(
            id: taskId,
            userId: "",
            projectIds: [],
            conversationId: nil,
            title: "Task not found",
            description: "",
            status: .pending,
            priority: .medium,
            dueDate: nil,
            completedAt: nil,
            tags: [],
            createdAt: Date(),
            updatedAt: Date(),
            metadata: nil
        )
    }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Task header with title, description, and metadata
                    TaskDetailHeader(task: task) {
                        showEditSheet = true
                    }
                    .padding(.horizontal)

                    // Subtasks section
                    if !task.subtasks.isEmpty {
                        SubtaskList(
                            subtasks: task.subtasks,
                            onToggleSubtask: { subtask in
                                toggleSubtask(subtask)
                            }
                        )
                        .padding(.horizontal)
                    } else if !task.hasProcessedSubtasks {
                        // Show generate button when no subtasks exist
                        GenerateSubtasksEmptyState(
                            isGenerating: isGeneratingSubtasks,
                            onGenerate: generateSubtasks
                        )
                        .padding(.horizontal)
                    }

                    // Additional actions section
                    if !task.subtasks.isEmpty && !task.hasProcessedSubtasks {
                        VStack(spacing: 12) {
                            Divider()

                            GenerateSubtasksButton(
                                isGenerating: isGeneratingSubtasks,
                                onGenerate: generateSubtasks
                            )
                        }
                        .padding(.horizontal)
                    }
                }
                .padding(.vertical)
            }
            .background(S2.Colors.primaryBackground)
            .navigationTitle("Task Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: { dismiss() }) {
                        Image(systemName: "chevron.down")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(S2.Colors.primaryText)
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button(action: { showEditSheet = true }) {
                            Label("Edit Task", systemImage: "pencil")
                        }

                        Button(action: markComplete) {
                            Label(
                                task.status == .completed ? "Mark Incomplete" : "Mark Complete",
                                systemImage: task.status == .completed ? "circle" : "checkmark.circle"
                            )
                        }

                        Divider()

                        Button(role: .destructive, action: deleteTask) {
                            Label("Delete Task", systemImage: "trash")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(S2.Colors.primaryText)
                    }
                }
            }
        }
        .sheet(isPresented: $showEditSheet) {
            // TODO: Add TaskEditView
            Text("Edit Task - Coming Soon")
        }
    }

    // MARK: - Actions

    private func generateSubtasks() {
        print("🎯 [TaskDetailView] Starting subtask generation for task: \(task.id)")
        isGeneratingSubtasks = true

        Task {
            print("📝 [TaskDetailView] Calling viewModel.generateSubtasks")
            await viewModel.generateSubtasks(for: task)

            await MainActor.run {
                self.isGeneratingSubtasks = false
                print("🎉 [TaskDetailView] Subtask generation complete")
            }
        }
    }

    private func toggleSubtask(_ subtask: UserTask) {
        // Find the parent task in viewModel and update it
        if let parentIndex = viewModel.tasks.firstIndex(where: { $0.id == taskId }),
           let subtaskIndex = viewModel.tasks[parentIndex].subtasks.firstIndex(where: { $0.id == subtask.id }) {

            viewModel.tasks[parentIndex].subtasks[subtaskIndex].status =
                viewModel.tasks[parentIndex].subtasks[subtaskIndex].status == .completed ? .pending : .completed
            viewModel.tasks[parentIndex].subtasks[subtaskIndex].completedAt =
                viewModel.tasks[parentIndex].subtasks[subtaskIndex].status == .completed ? Date() : nil

            // TODO: Persist to backend
        }
    }

    private func markComplete() {
        // Update in viewModel
        if let index = viewModel.tasks.firstIndex(where: { $0.id == taskId }) {
            viewModel.tasks[index].status = viewModel.tasks[index].status == .completed ? .pending : .completed
            viewModel.tasks[index].completedAt = viewModel.tasks[index].status == .completed ? Date() : nil
            // TODO: Persist to backend
        }
    }

    private func deleteTask() {
        // TODO: Implement delete through backend
        dismiss()
    }
}
