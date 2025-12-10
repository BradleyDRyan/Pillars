//
//  DrawerChatItem.swift
//  Squirrel2
//
//  Drawer chat item component - draggable conversation item
//

import SwiftUI

// MARK: - Drawer Chat Item (text only, no icon, draggable)
// Figma: List item with text-[17px] leading-[22px], px-[12px] py-[15px], h-[52px]
struct DrawerChatItem: View {
    let conversation: Conversation
    let action: () -> Void
    var isSelected: Bool = false
    var projects: [Project] = []
    var onAddToProject: ((Conversation, Project) -> Void)?
    var onRemoveFromProject: ((Conversation, Project) -> Void)?
    var onCreateProject: (() -> Void)?
    var onRename: ((Conversation) -> Void)?
    var onShare: ((Conversation) -> Void)?
    var onDelete: ((Conversation) -> Void)?
    
    @State private var isDragging = false
    
    var body: some View {
        Button(action: action) {
            HStack {
                // Figma: text-[17px] leading-[22px] font-regular, color #111112
                Text(conversation.title)
                    .font(.squirrelBody)
                    .lineSpacing(22 - 17) // line-height 22px
                    .foregroundColor(S2.Colors.primaryText)
            }
            // Figma: px-[12px] py-[15px]
            .padding(.horizontal, 12)
            .padding(.vertical, 15)
            // Figma: h-[52px]
            .frame(height: 52)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(backgroundColor)
            )
            .contentShape(Rectangle())
            .scaleEffect(isDragging ? 1.02 : 1.0)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: isDragging)
        }
        .buttonStyle(PlainButtonStyle())
        .contextMenu {
            ConversationMenuContent(
                conversation: conversation,
                projects: projects,
                onAddToProject: onAddToProject,
                onRemoveFromProject: onRemoveFromProject,
                onCreateProject: onCreateProject,
                onRename: onRename,
                onShare: onShare,
                onDelete: onDelete
            )
        }
        .draggable(conversation) {
            dragPreview
                .onAppear { isDragging = true }
                .onDisappear { isDragging = false }
        }
    }
    
    private var backgroundColor: Color {
        if isDragging {
            return S2.Colors.secondarySurface
        }
        return isSelected ? S2.Colors.secondarySurface : Color.clear
    }
}

// MARK: - Drag Preview
private extension DrawerChatItem {
    var dragPreview: some View {
        HStack(spacing: 8) {
            Image(systemName: "bubble.left.fill")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(S2.Colors.primaryText)
            
            Text(conversation.title)
                .font(.squirrelBody)
                .foregroundColor(S2.Colors.primaryText)
                .lineLimit(1)
                .frame(minWidth: 160, alignment: .leading) // keep a reasonable width
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(
            Capsule()
                .fill(S2.Colors.secondarySurface)
                .shadow(color: .black.opacity(0.25), radius: 8, x: 0, y: 4)
        )
    }
}

