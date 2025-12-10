//
//  DrawerProjectItem.swift
//  Squirrel2
//
//  Navigation item for projects in the drawer menu with drop support
//  Allows dragging chats onto projects to assign them
//

import SwiftUI

struct DrawerProjectItem: View {
    let project: Project
    let isSelected: Bool
    let action: () -> Void
    let onConversationDropped: (Conversation, Project) -> Void
    
    @State private var isTargeted = false
    
    var body: some View {
        Button(action: action) {
            // Figma: HStack with gap-[10px]
            HStack(spacing: 10) {
                // Icon - 36x36 to match DrawerNavItem
                (project.icon ?? .folder).iconView(size: 36)
                    .frame(width: 36, height: 36)
                
                // Title
                // Figma: text-[17px] leading-[22px] font-medium, color #111112
                Text(project.name)
                    .font(.system(size: 17, weight: .medium))
                    .lineSpacing(22 - 17) // line-height 22px
                    .foregroundColor(S2.Colors.primaryText)
                
                Spacer()
            }
            // Figma: p-[8px] (8px padding all around)
            .padding(8)
            // Figma: h-[52px]
            .frame(height: 52)
            .frame(maxWidth: .infinity)
            // Figma: rounded-[var(--round,1000px)]
            .background(
                RoundedRectangle(cornerRadius: 1000)
                    .fill(backgroundColor)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 1000)
                    .strokeBorder(isTargeted ? project.colorValue : Color.clear, lineWidth: 2)
            )
            .contentShape(Rectangle())
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: isTargeted)
        }
        .buttonStyle(PlainButtonStyle())
        .dropDestination(for: Conversation.self) { conversations, location in
            guard let conversation = conversations.first else { return false }
            onConversationDropped(conversation, project)
            return true
        } isTargeted: { targeted in
            withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
                isTargeted = targeted
            }
        }
    }
    
    private var backgroundColor: Color {
        if isTargeted {
            return project.colorValue.opacity(0.1)
        } else if isSelected {
            return S2.Colors.secondarySurface
        } else {
            return Color.clear
        }
    }
}

#Preview {
    VStack(spacing: 0) {
        DrawerProjectItem(
            project: Project(
                id: "1",
                userId: "user1",
                name: "Health",
                description: "Health related items",
                color: "#4CAF50",
                icon: .health,
                isDefault: false,
                isArchived: false,
                settings: nil,
                stats: Project.ProjectStats(conversationCount: 5, taskCount: 3, entryCount: 10, thoughtCount: 2),
                createdAt: Date(),
                updatedAt: Date(),
                metadata: nil
            ),
            isSelected: false,
            action: {},
            onConversationDropped: { _, _ in }
        )
        
        DrawerProjectItem(
            project: Project(
                id: "2",
                userId: "user1",
                name: "Finances",
                description: "Financial items",
                color: "#2196F3",
                icon: .money,
                isDefault: false,
                isArchived: false,
                settings: nil,
                stats: Project.ProjectStats(conversationCount: 3, taskCount: 2, entryCount: 5, thoughtCount: 1),
                createdAt: Date(),
                updatedAt: Date(),
                metadata: nil
            ),
            isSelected: true,
            action: {},
            onConversationDropped: { _, _ in }
        )
    }
    .padding()
}
