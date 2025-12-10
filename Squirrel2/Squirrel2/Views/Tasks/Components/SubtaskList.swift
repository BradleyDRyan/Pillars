//
//  SubtaskList.swift
//  Squirrel2
//
//  List of subtasks component
//

import SwiftUI

struct SubtaskList: View {
    let subtasks: [UserTask]
    let onToggleSubtask: (UserTask) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Text("Subtasks")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(S2.Colors.primaryText)

                Text("(\(completedCount)/\(subtasks.count))")
                    .font(.system(size: 14))
                    .foregroundColor(S2.Colors.secondaryText)

                Spacer()

                // Progress indicator
                if completedCount > 0 {
                    ProgressCircle(progress: progress)
                        .frame(width: 24, height: 24)
                }
            }
            .padding(.bottom, 4)

            // Subtask items
            VStack(spacing: 4) {
                ForEach(subtasks) { subtask in
                    SubtaskRow(subtask: subtask) {
                        onToggleSubtask(subtask)
                    }
                }
            }
        }
    }

    private var completedCount: Int {
        subtasks.filter { $0.status == .completed }.count
    }

    private var progress: Double {
        guard !subtasks.isEmpty else { return 0 }
        return Double(completedCount) / Double(subtasks.count)
    }
}

// Progress circle component
struct ProgressCircle: View {
    let progress: Double

    var body: some View {
        ZStack {
            Circle()
                .stroke(S2.Colors.tertiaryText.opacity(0.2), lineWidth: 2)

            Circle()
                .trim(from: 0, to: progress)
                .stroke(S2.Colors.accentGreen, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut(duration: 0.3), value: progress)

            if progress == 1 {
                Image(systemName: "checkmark")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(S2.Colors.accentGreen)
            }
        }
    }
}

#Preview {
    SubtaskList(
        subtasks: [
            UserTask(
                id: "1",
                userId: "test",
                projectIds: [],
                conversationId: nil,
                title: "Check car wash locations",
                description: "Find the nearest car wash",
                status: .completed,
                priority: .medium,
                dueDate: nil,
                completedAt: Date(),
                tags: [],
                createdAt: Date(),
                updatedAt: Date(),
                metadata: nil
            ),
            UserTask(
                id: "2",
                userId: "test",
                projectIds: [],
                conversationId: nil,
                title: "Drive to car wash",
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
        ],
        onToggleSubtask: { _ in }
    )
    .padding()
}