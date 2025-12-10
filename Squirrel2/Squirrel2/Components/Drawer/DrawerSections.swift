//
//  DrawerSections.swift
//  Squirrel2
//
//  Sections view for drawer - features, projects, and chats
//

import SwiftUI

struct DrawerSections: View {
    @Binding var selectedSection: Int
    @Binding var isDrawerOpen: Bool
    let selectedConversationId: String?
    let onNewProjectTapped: (() -> Void)?
    let onProjectTapped: ((Project) -> Void)?
    let onConversationTapped: ((Conversation) -> Void)?
    let onShowToast: ((String) -> Void)?
    
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
            // Features section
            featuresSection
            
            // Projects section
            projectsSection
            
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
                    onShowToast?("Chat renamed")
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
                    onShowToast?("Chat deleted")
                }
                conversationToDelete = nil
            }
        } message: {
            Text("Are you sure you want to delete this chat? This action cannot be undone.")
        }
    }
    
    // MARK: - Features Section
    
    private var featuresSection: some View {
        VStack(spacing: 0) {
            DrawerNavItem(
                icon: "Meta AI",
                title: "Meta AI",
                isSelected: selectedSection == 0,
                isSystemIcon: false
            ) {
                selectSection(0)
            }
            
            DrawerNavItem(
                icon: "For You",
                title: "For You",
                isSelected: selectedSection == 1,
                isSystemIcon: false
            ) {
                selectSection(1)
            }
            
            DrawerNavItem(
                icon: "Library",
                title: "Library",
                isSelected: selectedSection == 2,
                isSystemIcon: false
            ) {
                selectSection(2)
            }
            
            DrawerNavItem(
                icon: "Vibes",
                title: "Vibes",
                isSelected: selectedSection == 3,
                isSystemIcon: false
            ) {
                selectSection(3)
            }
        }
    }
    
    // MARK: - Projects Section
    
    private var projectsSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            // New Project item (always visible)
            DrawerNavItem(
                icon: "New Project",
                title: "New Project",
                isSelected: false,
                isSystemIcon: false
            ) {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                    isDrawerOpen = false
                }
                onNewProjectTapped?()
            }
            
            // Existing projects
            ForEach(viewModel.projects) { project in
                DrawerProjectItem(
                    project: project,
                    isSelected: false,
                    action: {
                        // Navigate to project view
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            isDrawerOpen = false
                        }
                        onProjectTapped?(project)
                    },
                    onConversationDropped: { conversation, targetProject in
                        handleConversationDropped(conversation, onto: targetProject)
                    }
                )
            }
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
                    DrawerChatItem(
                        conversation: conversation,
                        action: {
                            // Let parent handle drawer close + conversation change together
                            onConversationTapped?(conversation)
                        },
                        isSelected: conversation.id == selectedConversationId,
                        projects: viewModel.projects,
                        onAddToProject: { conv, project in
                            handleConversationDropped(conv, onto: project)
                        },
                        onRemoveFromProject: { conv, project in
                            viewModel.removeConversationFromProject(conversation: conv, project: project)
                        },
                        onCreateProject: {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                isDrawerOpen = false
                            }
                            onNewProjectTapped?()
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
    
    private func selectSection(_ section: Int) {
        selectedSection = section
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            isDrawerOpen = false
        }
    }
    
    private func handleConversationDropped(_ conversation: Conversation, onto project: Project) {
        // Assign conversation to project
        viewModel.assignConversationToProject(conversation: conversation, project: project)
        
        // Show feedback via root-level toast
        onShowToast?("Added to \(project.name)")
    }
    
    private func shareConversation(_ conversation: Conversation) {
        // Create shareable text with conversation title
        let shareText = "Check out my chat: \(conversation.title)"
        
        // Present share sheet
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = windowScene.windows.first,
              let rootVC = window.rootViewController else {
            return
        }
        
        let activityVC = UIActivityViewController(
            activityItems: [shareText],
            applicationActivities: nil
        )
        
        // For iPad: set popover presentation
        if let popover = activityVC.popoverPresentationController {
            popover.sourceView = window
            popover.sourceRect = CGRect(x: window.bounds.midX, y: window.bounds.midY, width: 0, height: 0)
            popover.permittedArrowDirections = []
        }
        
        rootVC.present(activityVC, animated: true)
    }
}

