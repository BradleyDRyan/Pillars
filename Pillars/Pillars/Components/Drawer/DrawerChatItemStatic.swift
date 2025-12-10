//
//  DrawerChatItemStatic.swift
//  Pillars
//
//  Drawer chat item for conversation list with context menu
//

import SwiftUI

struct DrawerChatItemStatic: View {
    let conversation: Conversation
    let action: () -> Void
    var onRename: ((Conversation) -> Void)?
    var onShare: ((Conversation) -> Void)?
    var onDelete: ((Conversation) -> Void)?
    
    var body: some View {
        Button(action: action) {
            HStack {
                Text(conversation.title)
                    .font(.system(size: 17, weight: .regular))
                    .foregroundColor(S2.Colors.primaryText)
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 15)
            .frame(height: 52)
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
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
    }
}
