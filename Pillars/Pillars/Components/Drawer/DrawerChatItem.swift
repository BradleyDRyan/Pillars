//
//  DrawerChatItem.swift
//  Pillars
//
//  Drawer chat item component - draggable conversation item
//

import SwiftUI

struct DrawerChatItem: View {
    let conversation: Conversation
    let action: () -> Void
    var isSelected: Bool = false
    var onRename: ((Conversation) -> Void)?
    var onShare: ((Conversation) -> Void)?
    var onDelete: ((Conversation) -> Void)?
    
    @State private var isDragging = false
    
    var body: some View {
        Button(action: action) {
            HStack {
                Text(conversation.title)
                    .font(.system(size: 17))
                    .foregroundColor(S2.Colors.primaryText)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 15)
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
            Button {
                onRename?(conversation)
            } label: {
                Label("Rename", systemImage: "pencil")
            }
            
            Button {
                onShare?(conversation)
            } label: {
                Label("Share", systemImage: "square.and.arrow.up")
            }
            
            Divider()
            
            Button(role: .destructive) {
                onDelete?(conversation)
            } label: {
                Label("Delete", systemImage: "trash")
            }
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
                .font(.system(size: 17))
                .foregroundColor(S2.Colors.primaryText)
                .lineLimit(1)
                .frame(minWidth: 160, alignment: .leading)
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
