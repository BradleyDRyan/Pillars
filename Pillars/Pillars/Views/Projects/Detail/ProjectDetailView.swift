//
//  ProjectDetailView.swift
//  Squirrel2
//
//  Main container view for viewing a project's contents
//  Based on Figma design showing chats, bookmarks, and files
//

import SwiftUI
import UIKit

// MARK: - Navigation Destination for new conversations
struct NewConversationDestination: Hashable {
    let pillarIds: [String]
    let initialMessage: String
}

struct ProjectDetailView: View {
    let project: Project
    var onMenuTapped: (() -> Void)?
    var onStartConversation: ((_ pillarIds: [String], _ initialMessage: String) -> Void)?
    var onOpenConversation: ((_ conversation: Conversation) -> Void)?  // Used when navigation style is "jump"
    var onCreateProjectTapped: (() -> Void)?  // For "Create Project" from context menu
    
    @State private var projectName: String
    @State private var renameProjectText: String
    
    @StateObject private var viewModel = ProjectsViewModel()
    @StateObject private var menuViewModel = DrawerViewModel()  // For conversation menu actions
    @EnvironmentObject var firebaseManager: FirebaseManager
    @Environment(\.dismiss) private var dismiss
    
    @State private var selectedFilter: ProjectFilter = .chats
    @State private var inputText = ""
    @FocusState private var isInputFocused: Bool
    
    // Navigation state for pushing to conversation (only used when style is "push")
    @State private var navigationPath = NavigationPath()
    
    // Context menu state
    @State private var showRenameAlert = false
    @State private var renameText = ""
    @State private var conversationForMenu: Conversation?
    @State private var showDeleteConfirmation = false
    @State private var showProjectOptions = false
    @State private var showProjectRenameAlert = false
    @State private var showProjectDeleteConfirmation = false
    
    // Read navigation style preference
    @AppStorage("settings.projectNavigationStyle") private var projectNavigationStyle = ProjectNavigationStyle.push.rawValue
    // Read tabs style preference
    @AppStorage("settings.projectTabsStyle") private var projectTabsStyle = ProjectTabsStyle.pills.rawValue
    
    private var usePushNavigation: Bool {
        projectNavigationStyle == ProjectNavigationStyle.push.rawValue
    }
    
    private var useSegmentedTabs: Bool {
        projectTabsStyle == ProjectTabsStyle.segmented.rawValue
    }
    
    init(
        project: Project,
        onMenuTapped: (() -> Void)? = nil,
        onStartConversation: ((_ pillarIds: [String], _ initialMessage: String) -> Void)? = nil,
        onOpenConversation: ((_ conversation: Conversation) -> Void)? = nil,
        onCreateProjectTapped: (() -> Void)? = nil
    ) {
        self.project = project
        self.onMenuTapped = onMenuTapped
        self.onStartConversation = onStartConversation
        self.onOpenConversation = onOpenConversation
        self.onCreateProjectTapped = onCreateProjectTapped
        _projectName = State(initialValue: project.name)
        _renameProjectText = State(initialValue: project.name)
    }
    
    var body: some View {
        NavigationStack(path: $navigationPath) {
            ZStack {
                // Background
                S2.Colors.primarySurface
                    .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Toolbar with menu and ellipsis buttons
                    ProjectDetailToolbar(
                        onMenuTapped: {
                            if let onMenuTapped = onMenuTapped {
                                onMenuTapped()
                            } else {
                                dismiss()
                            }
                        },
                        onMoreTapped: {
                            showProjectOptions = true
                        }
                    )
                    
                    // Header with icon and name
                    ProjectDetailHeader(project: project, projectName: projectName)
                        .padding(.bottom, S2.Spacing.lg)
                    
                    // Content with pills overlaid so list can scroll beneath them
                    ZStack(alignment: .top) {
                        // Main content with top padding to accommodate pills overlay
                        Group {
                            switch selectedFilter {
                            case .chats:
                                if viewModel.conversations.isEmpty {
                                    ProjectContentEmptyState(
                                        filter: selectedFilter,
                                        projectName: projectName
                                    )
                                } else {
                                    ProjectChatList(
                                        conversations: viewModel.conversations,
                                        onConversationTap: { conversation in
                                            if usePushNavigation {
                                                print("📱 [ProjectDetailView] Opening conversation via nav stack: \(conversation.id)")
                                                navigationPath.append(conversation)
                                            } else {
                                                print("📱 [ProjectDetailView] Opening conversation via jump: \(conversation.id)")
                                                onOpenConversation?(conversation)
                                            }
                                        },
                                        projects: menuViewModel.projects,
                                        currentProject: project,
                                        onAddToProject: { conversation, project in
                                            menuViewModel.assignConversationToProject(conversation: conversation, project: project)
                                        },
                                        onRemoveFromProject: { conversation, project in
                                            menuViewModel.removeConversationFromProject(conversation: conversation, project: project)
                                        },
                                        onCreateProject: onCreateProjectTapped,
                                        onRename: { conversation in
                                            renameText = conversation.title
                                            conversationForMenu = conversation
                                            showRenameAlert = true
                                        },
                                        onShare: { conversation in
                                            shareConversation(conversation)
                                        },
                                        onDelete: { conversation in
                                            conversationForMenu = conversation
                                            showDeleteConfirmation = true
                                        }
                                    )
                                }
                            case .bookmarks:
                                ProjectContentEmptyState(filter: selectedFilter, projectName: projectName)
                            case .files:
                                ProjectFilesView(project: project)
                            }
                        }
                        
                        // Filter pills overlay
                        if useSegmentedTabs {
                            ProjectFilterSegmentedControl(selectedFilter: $selectedFilter)
                                .padding(.horizontal, S2.Spacing.lg)
                        } else {
                            ProjectFilterPills(selectedFilter: $selectedFilter)
                                .padding(.horizontal, S2.Spacing.lg)
                        }
                    }
                    .padding(.bottom, S2.Spacing.md)
                    .frame(maxHeight: .infinity)
                }
            }
            .navigationBarHidden(true)
            .navigationDestination(for: Conversation.self) { conversation in
                ConversationView(
                    existingConversation: conversation,
                    showHeader: false
                )
                .navigationBarBackButtonHidden(false)
                .environmentObject(firebaseManager)
            }
            .navigationDestination(for: NewConversationDestination.self) { destination in
                ConversationView(
                    pillarIds: destination.pillarIds,
                    initialMessage: destination.initialMessage,
                    showHeader: false
                )
                .navigationBarBackButtonHidden(false)
                .environmentObject(firebaseManager)
            }
        }
        .onChange(of: projectTabsStyle) { oldValue, newValue in
            // Ensure segmented control only shows supported filters
            if newValue == ProjectTabsStyle.segmented.rawValue && selectedFilter == .bookmarks {
                selectedFilter = .chats
            }
        }
        .onAppear {
            // Align initial state with segmented control restrictions
            if useSegmentedTabs && selectedFilter == .bookmarks {
                selectedFilter = .chats
            }
        }
        .confirmationDialog("Project actions", isPresented: $showProjectOptions, titleVisibility: .visible) {
            Button("Rename Project") {
                renameProjectText = projectName
                showProjectRenameAlert = true
            }
            Button("Delete Project", role: .destructive) {
                showProjectDeleteConfirmation = true
            }
            Button("Cancel", role: .cancel) {}
        }
        .alert("Rename Chat", isPresented: $showRenameAlert) {
            TextField("Chat name", text: $renameText)
            Button("Cancel", role: .cancel) {}
            Button("Rename") {
                if let conversation = conversationForMenu {
                    menuViewModel.renameConversation(conversation, newTitle: renameText)
                }
            }
        } message: {
            Text("Enter a new name for this chat")
        }
        .alert("Delete Chat", isPresented: $showDeleteConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                if let conversation = conversationForMenu {
                    menuViewModel.deleteConversation(conversation)
                }
            }
        } message: {
            Text("Are you sure you want to delete this chat? This action cannot be undone.")
        }
        .alert("Rename Project", isPresented: $showProjectRenameAlert) {
            TextField("Project name", text: $renameProjectText)
            Button("Cancel", role: .cancel) {}
            Button("Rename") {
                let trimmedName = renameProjectText.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmedName.isEmpty else { return }
                
                Task {
                    do {
                        try await viewModel.updateProject(project, name: trimmedName)
                        projectName = trimmedName
                    } catch {
                        print("❌ [ProjectDetailView] Error renaming project: \(error.localizedDescription)")
                    }
                }
            }
        } message: {
            Text("Enter a new name for this project")
        }
        .alert("Delete Project", isPresented: $showProjectDeleteConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                Task {
                    do {
                        try await viewModel.deleteProject(project)
                        dismiss()
                    } catch {
                        print("❌ [ProjectDetailView] Error deleting project: \(error.localizedDescription)")
                    }
                }
            }
        } message: {
            Text("Are you sure you want to delete this project? This action cannot be undone.")
        }
        .onAppear {
            // Remember the last opened project so share-sheet uploads know where to go.
            ShareHandoffManager.shared.rememberLastProject(project)
            if let userId = firebaseManager.currentUser?.uid {
                viewModel.startListening(userId: userId)
                viewModel.startListeningToConversations(forProject: project.id)
                menuViewModel.startListening(userId: userId)
            }
        }
        .onDisappear {
            viewModel.stopListeningToConversations()
            menuViewModel.stopListening()
        }
        // If a share intent targets this project, jump straight to the Files tab
        .onReceive(NotificationCenter.default.publisher(for: .sharedFilesQueued)) { notification in
            let targetProjectId = notification.userInfo?["projectId"] as? String
            if targetProjectId == nil || targetProjectId == project.id {
                selectedFilter = .files
            }
        }
        .safeAreaBar(edge: .bottom) {
            if selectedFilter != .files {
                Composer(
                    placeholder: "Ask about \(projectName)",
                    text: $inputText,
                    onSend: {
                        print("🚀 [ProjectDetailView] Composer onSend triggered")
                        print("🚀 [ProjectDetailView] inputText: '\(inputText)'")
                        print("🚀 [ProjectDetailView] project.id: \(project.id)")
                        
                        // Start new conversation in this project
                        let message = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !message.isEmpty else {
                            print("⚠️ [ProjectDetailView] Message is empty, returning")
                            return
                        }
                        
                        inputText = ""
                        
                        if usePushNavigation {
                            // Navigate within the project's navigation stack
                            print("📱 [ProjectDetailView] Starting new conversation via nav stack")
                            let destination = NewConversationDestination(
                                pillarIds: [project.id],
                                initialMessage: message
                            )
                            navigationPath.append(destination)
                        } else {
                            // Jump style - switch main view
                            print("📱 [ProjectDetailView] Starting new conversation via jump")
                            onStartConversation?([project.id], message)
                        }
                    }
                )
            }
        }
    }
    
    // MARK: - Actions
    
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

// MARK: - Filter Enum

enum ProjectFilter: String, CaseIterable {
    case chats = "Chats"
    case bookmarks = "Bookmarks"
    case files = "Files"
}


#Preview {
    ProjectDetailView(
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
        )
    )
}

