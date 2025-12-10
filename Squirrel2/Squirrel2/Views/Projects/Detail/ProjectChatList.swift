//
//  ProjectChatList.swift
//  Squirrel2
//
//  List of conversations within a project
//

import SwiftUI

struct ProjectChatList: View {
    let conversations: [Conversation]
    let onConversationTap: (Conversation) -> Void
    
    // Context menu support
    var projects: [Project] = []
    var currentProject: Project? = nil  // The project we're currently viewing
    var onAddToProject: ((Conversation, Project) -> Void)?
    var onRemoveFromProject: ((Conversation, Project) -> Void)?
    var onCreateProject: (() -> Void)?
    var onRename: ((Conversation) -> Void)?
    var onShare: ((Conversation) -> Void)?
    var onDelete: ((Conversation) -> Void)?
    
    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(conversations) { conversation in
                    ProjectChatRow(
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
                    .contentShape(Rectangle())
                    .onTapGesture {
                        onConversationTap(conversation)
                    }
                }
            }
            .padding(.top, 40)
            .padding(.bottom, S2.Spacing.lg)
            .padding(.horizontal, 12)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(S2.Colors.primarySurface)
    }
}

#Preview {
    ProjectChatList(
        conversations: [
            Conversation(
                id: "1",
                userId: "user1",
                projectIds: ["project1"],
                title: "Lab results questions",
                lastMessage: "The glucose levels look normal...",
                createdAt: Date().addingTimeInterval(-86400 * 3),
                updatedAt: Date().addingTimeInterval(-86400 * 3)
            ),
            Conversation(
                id: "2",
                userId: "user1",
                projectIds: ["project1"],
                title: "Tax Prep & Savings Strategy",
                lastMessage: "Here are some tips...",
                createdAt: Date().addingTimeInterval(-86400 * 6),
                updatedAt: Date().addingTimeInterval(-86400 * 6)
            )
        ],
        onConversationTap: { _ in },
        onDelete: { _ in }
    )
}

