//
//  TaskDetailHeader.swift
//  Squirrel2
//
//  Header section for task detail view
//

import SwiftUI

struct TaskDetailHeader: View {
    let task: UserTask
    let onEdit: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Title and edit button
            HStack(alignment: .top) {
                Text(task.title)
                    .font(.system(size: 24, weight: .bold))
                    .foregroundColor(S2.Colors.primaryText)
                    .fixedSize(horizontal: false, vertical: true)

                Spacer()

                Button(action: onEdit) {
                    Image(systemName: "pencil")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(S2.Colors.primaryBrand)
                        .frame(width: 32, height: 32)
                        .background(S2.Colors.secondarySurface)
                        .clipShape(Circle())
                }
            }

            // Description
            if !task.description.isEmpty {
                Text(task.description)
                    .font(.system(size: 15))
                    .foregroundColor(S2.Colors.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }

            // Metadata chips
            HStack(spacing: 8) {
                // Priority chip
                TaskChip(
                    icon: "flag.fill",
                    text: task.priority.displayName,
                    color: task.priority.color
                )

                // Due date chip
                if let dueDate = task.dueDate {
                    TaskChip(
                        icon: "calendar",
                        text: formatDueDate(dueDate),
                        color: task.isOverdue ? .red : S2.Colors.primaryText
                    )
                }

                // Status chip
                if task.status == .completed {
                    TaskChip(
                        icon: "checkmark.circle.fill",
                        text: "Completed",
                        color: S2.Colors.accentGreen
                    )
                }
            }
        }
    }

    private func formatDueDate(_ date: Date) -> String {
        let calendar = Calendar.current

        if calendar.isDateInToday(date) {
            return "Today"
        } else if calendar.isDateInTomorrow(date) {
            return "Tomorrow"
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday"
        } else {
            let formatter = DateFormatter()
            formatter.dateStyle = .medium
            return formatter.string(from: date)
        }
    }
}

struct TaskChip: View {
    let icon: String
    let text: String
    let color: Color

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 12))
            Text(text)
                .font(.system(size: 13, weight: .medium))
        }
        .foregroundColor(color)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(color.opacity(0.1))
        .cornerRadius(12)
    }
}

#Preview {
    TaskDetailHeader(
        task: UserTask(
            id: "1",
            userId: "test",
            projectIds: [],
            conversationId: nil,
            title: "Get the car washed",
            description: "Take the car to the car wash this weekend",
            status: .pending,
            priority: .high,
            dueDate: Date().addingTimeInterval(86400),
            completedAt: nil,
            tags: [],
            createdAt: Date(),
            updatedAt: Date(),
            metadata: nil
        ),
        onEdit: {}
    )
    .padding()
}