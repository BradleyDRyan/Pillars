//
//  ProjectDetailHeader.swift
//  Squirrel2
//
//  Header showing project icon and name (e.g., heart + "Health")
//

import SwiftUI

struct ProjectDetailHeader: View {
    let project: Project
    let projectName: String
    
    init(project: Project, projectName: String? = nil) {
        self.project = project
        self.projectName = projectName ?? project.name
    }
    
    var body: some View {
        HStack(spacing: 8) {
            // Project icon
            ProjectIconView(project: project, size: 36)
            
            // Project name
            Text(projectName)
                .font(.system(size: 24, weight: .semibold))
                .foregroundColor(S2.Colors.primaryText)
            
            Spacer()
        }
        .padding(.top, 24)
        // Match ConversationHeader: 20px horizontal
        .padding(.horizontal, 20)
    }
}

#Preview {
    ProjectDetailHeader(
        project: Project(
            id: "1",
            userId: "user1",
            name: "Health",
            description: "",
            color: "#CF263E",
            icon: .health,
            stats: Project.ProjectStats(conversationCount: 0, taskCount: 0, entryCount: 0, thoughtCount: 0),
            createdAt: Date(),
            updatedAt: Date()
        )
    )
}

