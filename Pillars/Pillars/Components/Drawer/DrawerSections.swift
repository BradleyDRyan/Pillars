//
//  DrawerSections.swift
//  Pillars
//
//  Sections view for drawer - chats list
//

import SwiftUI

struct DrawerSections: View {
    @Binding var isDrawerOpen: Bool
    let onConversationTapped: ((Conversation) -> Void)?
    
    @ObservedObject var viewModel: DrawerViewModel
    
    // State for rename alert
    @State private var showRenameAlert = false
    @State private var renameText = ""
    @State private var conversationToRename: Conversation?
    
    // State for delete confirmation
    @State private var showDeleteConfirmation = false
    @State private var conversationToDelete: Conversation?
    
    var body: some View {
        VStack(spacing: 24) {
            // Chats section
            chatsSection
        }
        .alert("Rename Chat", isPresented: $showRenameAlert) {
            TextField("Chat name", text: $renameText)
            Button("Cancel", role: .cancel) {
                conversationToRename = nil
            }
            Button("Rename") {
                if let conversation = conversationToRename {
                    viewModel.renameConversation(conversation, newTitle: renameText)
                }
                conversationToRename = nil
            }
        } message: {
            Text("Enter a new name for this chat")
        }
        .alert("Delete Chat", isPresented: $showDeleteConfirmation) {
            Button("Cancel", role: .cancel) {
                conversationToDelete = nil
            }
            Button("Delete", role: .destructive) {
                if let conversation = conversationToDelete {
                    viewModel.deleteConversation(conversation)
                }
                conversationToDelete = nil
            }
        } message: {
            Text("Are you sure you want to delete this chat? This action cannot be undone.")
        }
    }
    
    // MARK: - Chats Section
    
    private var chatsSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            DrawerSectionHeader(title: "Chats")
            
            if viewModel.recentConversations.isEmpty {
                Text("No recent chats")
                    .font(.system(size: 15))
                    .foregroundColor(S2.Colors.secondaryText)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 15)
            } else {
                ForEach(viewModel.recentConversations) { conversation in
                    DrawerChatItemStatic(
                        conversation: conversation,
                        action: {
                            onConversationTapped?(conversation)
                        },
                        onRename: { conv in
                            renameText = conv.title
                            conversationToRename = conv
                            showRenameAlert = true
                        },
                        onShare: { conv in
                            shareConversation(conv)
                        },
                        onDelete: { conv in
                            conversationToDelete = conv
                            showDeleteConfirmation = true
                        }
                    )
                }
            }
        }
    }
    
    // MARK: - Helper Methods
    
    private func shareConversation(_ conversation: Conversation) {
        let shareText = "Check out my chat: \(conversation.title)"
        
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = windowScene.windows.first,
              let rootVC = window.rootViewController else {
            return
        }
        
        let activityVC = UIActivityViewController(
            activityItems: [shareText],
            applicationActivities: nil
        )
        
        if let popover = activityVC.popoverPresentationController {
            popover.sourceView = window
            popover.sourceRect = CGRect(x: window.bounds.midX, y: window.bounds.midY, width: 0, height: 0)
            popover.permittedArrowDirections = []
        }
        
        rootVC.present(activityVC, animated: true)
    }
}
