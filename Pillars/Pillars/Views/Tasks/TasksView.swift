//
//  TasksView.swift
//  Squirrel2
//
//  Main tasks tab view container
//

import SwiftUI

struct TasksTabView: View {
    @EnvironmentObject var firebaseManager: FirebaseManager
    @StateObject private var viewModel = TasksViewModel()
    @State private var selectedTask: UserTask?
    @State private var showingSettings = false
    @State private var showingCreateTask = false
    @State private var selectedFilter: TaskFilter = .all
    @State private var showComposer = false

    private var filteredTasks: [UserTask] {
        switch selectedFilter {
        case .all:
            return viewModel.tasks
        case .today:
            return viewModel.tasks.filter { task in
                guard let dueDate = task.dueDate else { return false }
                return Calendar.current.isDateInToday(dueDate)
            }
        case .upcoming:
            return viewModel.tasks.filter { task in
                guard let dueDate = task.dueDate else { return false }
                return dueDate > Date() && !Calendar.current.isDateInToday(dueDate)
            }
        case .completed:
            return viewModel.tasks.filter { $0.status == .completed }
        case .high:
            return viewModel.tasks.filter { $0.priority == .high }
        }
    }

    private var taskCounts: [TaskFilter: Int] {
        [
            .all: viewModel.tasks.count,
            .today: viewModel.tasks.filter { task in
                guard let dueDate = task.dueDate else { return false }
                return Calendar.current.isDateInToday(dueDate)
            }.count,
            .upcoming: viewModel.tasks.filter { task in
                guard let dueDate = task.dueDate else { return false }
                return dueDate > Date() && !Calendar.current.isDateInToday(dueDate)
            }.count,
            .completed: viewModel.tasks.filter { $0.status == .completed }.count,
            .high: viewModel.tasks.filter { $0.priority == .high }.count
        ]
    }

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Custom header
                TaskViewHeader(
                    showingSettings: $showingSettings,
                    showingCreateTask: $showingCreateTask
                )

                // Category filter pills
                if !viewModel.tasks.isEmpty {
                    TaskCategoryPills(
                        selectedFilter: $selectedFilter,
                        taskCounts: taskCounts
                    )
                    .padding(.bottom, S2.Spacing.lg)
                }

                // Task content
                if viewModel.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .padding(.top, 100)
                } else if !filteredTasks.isEmpty {
                    TaskList(tasks: filteredTasks) { task in
                        selectedTask = task
                    }
                } else {
                    TaskEmptyState()
                }
            }
            .background(S2.Colors.elevated)
            .navigationBarHidden(true)
            .safeAreaInset(edge: .bottom) {
                if showComposer {
                    TaskComposerView(
                        onTaskCreated: {
                            // Refresh tasks after creation
                            if let userId = firebaseManager.currentUser?.uid {
                                viewModel.startListening(userId: userId)
                            }
                            // Hide composer after creating task
                            showComposer = false
                        },
                        onDismiss: {
                            // Hide composer when X button is tapped
                            withAnimation(.easeInOut(duration: 0.3)) {
                                showComposer = false
                            }
                        }
                    )
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .sheet(isPresented: $showingSettings) {
                SettingsView()
                    .environmentObject(firebaseManager)
            }
            .sheet(item: $selectedTask) { task in
                TaskDetailView(taskId: task.id, viewModel: viewModel)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
                    .onDisappear {
                        selectedTask = nil
                    }
            }
            .onChange(of: showingCreateTask) { oldValue, newValue in
                if newValue && !oldValue {
                    // Show the composer instead of the sheet
                    withAnimation(.easeInOut(duration: 0.3)) {
                        showComposer = true
                    }
                    // Reset the flag
                    showingCreateTask = false
                }
            }
        }
        .onAppear {
            if let userId = firebaseManager.currentUser?.uid {
                viewModel.startListening(userId: userId)
            }
        }
        .onDisappear {
            viewModel.stopListening()
        }
    }
}
