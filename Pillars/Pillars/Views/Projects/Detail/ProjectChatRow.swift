//
//  ProjectChatRow.swift
//  Squirrel2
//
//  Individual chat row showing title and relative date
//

import SwiftUI

struct ProjectChatRow: View {
    let conversation: Conversation
    
    // Context menu callbacks
    var projects: [Project] = []
    var currentProject: Project? = nil  // The project we're currently viewing
    var onAddToProject: ((Conversation, Project) -> Void)?
    var onRemoveFromProject: ((Conversation, Project) -> Void)?
    var onCreateProject: (() -> Void)?
    var onRename: ((Conversation) -> Void)?
    var onShare: ((Conversation) -> Void)?
    var onDelete: ((Conversation) -> Void)?
    
    var body: some View {
        ListItem(
            leadingAccessory: {
                EmptyView()
            },
            title: conversation.title,
            subtitle: {
                Text(relativeDate)
                    .font(.squirrelSubheadline)
                    .foregroundColor(S2.Colors.secondaryText)
                    .lineLimit(1)
            }
        )
        .contentShape(Rectangle())
        .contextMenu {
            ConversationMenuContent(
                conversation: conversation,
                projects: projects,
                currentProject: currentProject,
                onAddToProject: onAddToProject,
                onRemoveFromProject: onRemoveFromProject,
                onCreateProject: onCreateProject,
                onRename: onRename,
                onShare: onShare,
                onDelete: onDelete
            )
        }
    }
    
    private var relativeDate: String {
        let calendar = Calendar.current
        let now = Date()
        let date = conversation.updatedAt
        
        let components = calendar.dateComponents([.minute, .hour, .day, .weekOfYear, .month], from: date, to: now)
        
        // Minutes ago (less than 1 hour)
        if let minutes = components.minute, minutes < 60 {
            if minutes < 1 {
                return "Just now"
            } else if minutes == 1 {
                return "1 min ago"
            } else {
                return "\(minutes) min ago"
            }
        }
        
        // Hours ago (less than 24 hours)
        if let hours = components.hour, hours < 24 {
            if hours == 1 {
                return "1 hour ago"
            } else {
                return "\(hours) hours ago"
            }
        }
        
        // Days ago
        if let days = components.day {
            if days == 1 {
                return "Yesterday"
            } else if days < 7 {
                return "\(days) days ago"
            } else if days < 30 {
                let weeks = days / 7
                return weeks == 1 ? "1 week ago" : "\(weeks) weeks ago"
            } else if days < 365 {
                let months = days / 30
                return months == 1 ? "1 month ago" : "\(months) months ago"
            } else {
                let years = days / 365
                return years == 1 ? "1 year ago" : "\(years) years ago"
            }
        }
        
        // Fallback to formatted date
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
    
    // Combine size placeholder + date to mirror Figma row meta
    private var relativeDateMetadata: String {
        let size = "85kb" // placeholder; update if you have real size info
        if relativeDate.isEmpty {
            return size
        }
        return "\(size) · \(relativeDate)"
    }
}

#Preview {
    List {
        ProjectChatRow(
            conversation: Conversation(
                id: "1",
                userId: "user1",
                pillarIds: ["project1"],
                title: "Lab results questions",
                lastMessage: "The glucose levels look normal...",
                createdAt: Date().addingTimeInterval(-86400 * 3),
                updatedAt: Date().addingTimeInterval(-86400 * 3)
            )
        )
        
        ProjectChatRow(
            conversation: Conversation(
                id: "2",
                userId: "user1",
                pillarIds: ["project1"],
                title: "Glucose vs A1C",
                lastMessage: nil,
                createdAt: Date().addingTimeInterval(-86400 * 6),
                updatedAt: Date().addingTimeInterval(-86400 * 6)
            )
        )
    }
    .listStyle(.plain)
}

