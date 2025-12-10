//
//  SubtaskRow.swift
//  Squirrel2
//
//  A single subtask row component
//

import SwiftUI

struct SubtaskRow: View {
    let subtask: UserTask
    let onToggle: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            // Checkbox
            Button(action: onToggle) {
                Image(systemName: subtask.status == .completed ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 20))
                    .foregroundColor(subtask.status == .completed ? S2.Colors.accentGreen : S2.Colors.tertiaryIcon)
            }

            // Content
            VStack(alignment: .leading, spacing: 2) {
                Text(subtask.title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(S2.Colors.primaryText)
                    .strikethrough(subtask.status == .completed, color: S2.Colors.secondaryText)
                    .animation(.easeInOut(duration: 0.2), value: subtask.status)

                if !subtask.description.isEmpty {
                    Text(subtask.description)
                        .font(.system(size: 12))
                        .foregroundColor(S2.Colors.secondaryText)
                        .lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
    }
}

#Preview {
    VStack(spacing: 8) {
        SubtaskRow(
            subtask: UserTask(
                id: "1",
                userId: "test",
                projectIds: [],
                conversationId: nil,
                title: "Check car wash locations",
                description: "Find the nearest car wash with good reviews",
                status: .pending,
                priority: .medium,
                dueDate: nil,
                completedAt: nil,
                tags: [],
                createdAt: Date(),
                updatedAt: Date(),
                metadata: nil
            ),
            onToggle: {}
        )

        SubtaskRow(
            subtask: UserTask(
                id: "2",
                userId: "test",
                projectIds: [],
                conversationId: nil,
                title: "Drive to car wash",
                description: "",
                status: .completed,
                priority: .medium,
                dueDate: nil,
                completedAt: Date(),
                tags: [],
                createdAt: Date(),
                updatedAt: Date(),
                metadata: nil
            ),
            onToggle: {}
        )
    }
    .padding()
    .background(S2.Colors.primaryBackground)
}