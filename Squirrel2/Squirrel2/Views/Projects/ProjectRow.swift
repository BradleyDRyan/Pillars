//
//  ProjectRow.swift
//  Squirrel2
//
//  Individual project row with icon, name, stats, and swipe actions
//

import SwiftUI

struct ProjectRow: View {
    let project: Project
    let onTap: () -> Void
    let onEdit: () -> Void
    let onDelete: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Project Icon
                ProjectIconView(project: project, size: 48)
                
                // Project info
                VStack(alignment: .leading, spacing: 4) {
                    Text(project.name)
                        .font(.system(size: 17, weight: .medium))
                        .foregroundColor(S2.Colors.primaryText)
                    
                    // Stats subtitle
                    HStack(spacing: 8) {
                        if project.stats.conversationCount > 0 {
                            Label("\(project.stats.conversationCount)", systemImage: "bubble.left")
                                .font(.system(size: 13))
                                .foregroundColor(S2.Colors.secondaryText)
                        }
                        
                        if project.stats.taskCount > 0 {
                            Label("\(project.stats.taskCount)", systemImage: "checkmark.circle")
                                .font(.system(size: 13))
                                .foregroundColor(S2.Colors.secondaryText)
                        }
                        
                        if project.stats.conversationCount == 0 && project.stats.taskCount == 0 {
                            Text("No items yet")
                                .font(.system(size: 13))
                                .foregroundColor(S2.Colors.tertiaryText)
                        }
                    }
                }
                
                Spacer()
                
                // Chevron
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(S2.Colors.tertiaryIcon)
            }
            .padding(.horizontal, S2.Spacing.lg)
            .padding(.vertical, S2.Spacing.md)
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive) {
                onDelete()
            } label: {
                Label("Delete", systemImage: "trash")
            }
            
            Button {
                onEdit()
            } label: {
                Label("Edit", systemImage: "pencil")
            }
            .tint(.orange)
        }
    }
}

// MARK: - Project Icon View

struct ProjectIconView: View {
    let project: Project
    let size: CGFloat
    
    var body: some View {
        (project.icon ?? .folder).iconView(size: size)
    }
}

#Preview {
    VStack(spacing: 0) {
        ProjectRow(
            project: Project(
                id: "1",
                userId: "user1",
                name: "Health",
                description: "Health related items",
                color: "#CF263E",
                icon: .health,
                stats: Project.ProjectStats(conversationCount: 4, taskCount: 2, entryCount: 0, thoughtCount: 0),
                createdAt: Date(),
                updatedAt: Date()
            ),
            onTap: {},
            onEdit: {},
            onDelete: {}
        )
        
        Divider()
            .padding(.leading, 72)
        
        ProjectRow(
            project: Project(
                id: "2",
                userId: "user1",
                name: "Finances",
                description: "",
                color: "#2196F3",
                icon: .money,
                stats: Project.ProjectStats(conversationCount: 0, taskCount: 0, entryCount: 0, thoughtCount: 0),
                createdAt: Date(),
                updatedAt: Date()
            ),
            onTap: {},
            onEdit: {},
            onDelete: {}
        )
    }
}
