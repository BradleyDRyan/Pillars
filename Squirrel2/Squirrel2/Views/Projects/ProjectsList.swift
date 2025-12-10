//
//  ProjectsList.swift
//  Squirrel2
//
//  Scrollable list of project rows
//

import SwiftUI

struct ProjectsList: View {
    let projects: [Project]
    let onProjectTap: (Project) -> Void
    let onEditProject: (Project) -> Void
    let onDeleteProject: (Project) -> Void
    
    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(projects) { project in
                    VStack(spacing: 0) {
                        ProjectRow(
                            project: project,
                            onTap: { onProjectTap(project) },
                            onEdit: { onEditProject(project) },
                            onDelete: { onDeleteProject(project) }
                        )
                        
                        // Divider between rows
                        if project.id != projects.last?.id {
                            Divider()
                                .padding(.leading, 72)
                        }
                    }
                }
            }
            .padding(.vertical, S2.Spacing.sm)
        }
    }
}

#Preview {
    ProjectsList(
        projects: [
            Project(
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
            Project(
                id: "2",
                userId: "user1",
                name: "Finances",
                description: "Financial planning",
                color: "#2196F3",
                icon: .money,
                stats: Project.ProjectStats(conversationCount: 3, taskCount: 5, entryCount: 0, thoughtCount: 0),
                createdAt: Date(),
                updatedAt: Date()
            )
        ],
        onProjectTap: { _ in },
        onEditProject: { _ in },
        onDeleteProject: { _ in }
    )
}

