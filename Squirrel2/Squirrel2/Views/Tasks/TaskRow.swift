//
//  TaskRow.swift
//  Squirrel2
//
//  Individual task row item component
//

import SwiftUI

struct TaskRow: View {
    let task: UserTask
    let onTap: () -> Void
    @State private var isCompleted: Bool = false

    var body: some View {
        HStack(spacing: 12) {
            // Checkbox
            Button(action: {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                    isCompleted.toggle()
                    // TODO: Add task completion logic
                }
            }) {
                Image(systemName: isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundColor(isCompleted ? S2.Colors.accentGreen : S2.Colors.tertiaryIcon)
            }

            // Task content
            VStack(alignment: .leading, spacing: 2) {
                Text(task.title)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(S2.Colors.primaryText)
                    .strikethrough(isCompleted, color: S2.Colors.secondaryText)

                // Description or due date
                if let dueDate = task.dueDate {
                    Text(formatDueDate(dueDate))
                        .font(.system(size: 12))
                        .foregroundColor(dueDateColor(dueDate))
                } else if !task.description.isEmpty {
                    Text(task.description)
                        .font(.system(size: 12))
                        .foregroundColor(S2.Colors.secondaryText)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // Chevron
            Image(systemName: "chevron.right")
                .font(.system(size: 14))
                .foregroundColor(S2.Colors.tertiaryIcon)
        }
        .padding(.horizontal, S2.Spacing.lg)
        .padding(.vertical, 14)
        .contentShape(Rectangle())
        .onTapGesture {
            onTap()
        }
        .onAppear {
            isCompleted = task.status == .completed
        }
    }

    private func formatDueDate(_ date: Date) -> String {
        let calendar = Calendar.current
        let now = Date()

        if calendar.isDateInToday(date) {
            return "Today"
        } else if calendar.isDateInTomorrow(date) {
            return "Tomorrow"
        } else if date < now {
            return "Overdue"
        } else if calendar.isDate(date, equalTo: now, toGranularity: .weekOfYear) {
            let formatter = DateFormatter()
            formatter.dateFormat = "EEEE"
            return formatter.string(from: date)
        } else {
            let formatter = DateFormatter()
            formatter.dateStyle = .short
            return formatter.string(from: date)
        }
    }

    private func dueDateColor(_ date: Date) -> Color {
        let now = Date()
        if date < now {
            return S2.Colors.error
        } else if Calendar.current.isDateInToday(date) {
            return S2.Colors.secondaryBrand
        } else {
            return S2.Colors.secondaryText
        }
    }
}