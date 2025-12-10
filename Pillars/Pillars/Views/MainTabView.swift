//
//  MainTabView.swift
//  Squirrel2
//
//  Main container with drawer navigation and active view switching
//

import SwiftUI
import FirebaseAuth
import QuartzCore

// MARK: - Manual Animator (bypasses SwiftUI animation system entirely)
// Uses simple ease-out curve - immune to view hierarchy changes
class DrawerAnimator: ObservableObject {
    @Published private(set) var offset: CGFloat = 0
    
    private var displayLink: CADisplayLink?
    private var startOffset: CGFloat = 0
    private var targetOffset: CGFloat = 0
    private var startTime: CFTimeInterval = 0
    
    // Animation duration in seconds
    private let duration: CGFloat = 0.22
    
    func setOffset(_ newOffset: CGFloat, animated: Bool) {
        if animated {
            startOffset = offset
            targetOffset = newOffset
            startTime = CACurrentMediaTime()
            startDisplayLink()
        } else {
            targetOffset = newOffset
            offset = newOffset
            stopDisplayLink()
        }
    }
    
    private func startDisplayLink() {
        guard displayLink == nil else {
            // Already running - just update start values for smooth transition
            startOffset = offset
            startTime = CACurrentMediaTime()
            return
        }
        displayLink = CADisplayLink(target: self, selector: #selector(tick))
        displayLink?.add(to: .main, forMode: .common)
    }
    
    private func stopDisplayLink() {
        displayLink?.invalidate()
        displayLink = nil
    }
    
    @objc private func tick(displayLink: CADisplayLink) {
        let elapsed = CGFloat(CACurrentMediaTime() - startTime)
        let progress = min(elapsed / duration, 1.0)
        
        // Ease-out cubic: 1 - (1 - t)³
        let eased = 1 - pow(1 - progress, 3)
        
        offset = startOffset + (targetOffset - startOffset) * eased
        
        if progress >= 1.0 {
            offset = targetOffset
            stopDisplayLink()
        }
    }
    
    deinit {
        displayLink?.invalidate()
    }
}

// MARK: - Active View (single source of truth for navigation)
enum ActiveView: Equatable {
    case conversation(Conversation?)  // nil = new chat
    case newConversation(pillarIds: [String], initialMessage: String)  // New chat with context
    case project(Project)
    case forYou
    case library
    case vibes
    
    // Map to drawer section index for highlighting
    var drawerSectionIndex: Int {
        switch self {
        case .conversation(let conversation):
            // Only highlight Meta AI for a brand-new chat
            return conversation == nil ? 0 : -1
        case .newConversation:
            return 0  // Meta AI new chat entry point
        case .forYou: return 1
        case .library: return 2
        case .vibes: return 3
        case .project: return -1  // No section highlighted for projects
        }
    }
}

struct MainTabView: View {
    // IMPORTANT: Do NOT use @EnvironmentObject here!
    // Using @EnvironmentObject causes MainTabView to RE-RENDER whenever firebaseManager changes,
    // which interrupts in-flight animations. Instead, we pass the shared instance directly to children.
    
    // Single state for navigation
    @State private var activeView: ActiveView = .conversation(nil)
    
    @State private var isDrawerOpen = false
    @State private var showingSettings = false
    @State private var showingCreateProject = false
    @State private var dragOffset: CGFloat = 0
    
    // Manual animator that bypasses SwiftUI's animation system entirely
    // This is immune to view hierarchy changes because it uses CADisplayLink
    @StateObject private var drawerAnimator = DrawerAnimator()
    
    // Toast state - at root level for proper positioning
    @State private var showToast = false
    @State private var toastMessage = ""
    
    // ViewModel for project creation
    @StateObject private var projectsViewModel = ProjectsViewModel()
    
    // Pending project to open when a share-sheet file arrives
    @State private var pendingShareProjectId: String?
    @State private var showShareProjectPicker = false
    
    private let drawerWidth: CGFloat = 320
    private let animationResponse: Double = 0.3
    
    var body: some View {
        ZStack(alignment: .leading) {
            // Main content (pushes right when drawer opens)
            // CRITICAL: The offset is on a STABLE Color.clear container, NOT on contentView.
            // When contentView's identity changes (via .id()), only the overlay is replaced,
            // but Color.clear (and its offset animation) continues uninterrupted.
            Color.clear
                .overlay {
                    contentView
                        .environmentObject(FirebaseManager.shared)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.white)
                // Use manual animator offset - immune to view hierarchy changes
                .offset(x: drawerAnimator.offset + dragOffset)
                .gesture(drawerGesture)
            
            // Scrim overlay
            Color.black
                .opacity(scrimOpacity)
                .ignoresSafeArea()
                .onTapGesture {
                    isDrawerOpen = false
                    drawerAnimator.setOffset(0, animated: true)
                }
                .allowsHitTesting(drawerAnimator.offset > 0 || dragOffset > 0)
            
            // Drawer
            Drawer(
                selectedSection: Binding(
                    get: { activeView.drawerSectionIndex },
                    set: { newValue in
                        switch newValue {
                        case 0: activeView = .conversation(nil)
                        case 1: activeView = .forYou
                        case 2: activeView = .library
                        case 3: activeView = .vibes
                        default: break
                        }
                    }
                ),
                selectedConversationId: selectedConversationId,
                isDrawerOpen: $isDrawerOpen,
                onChatTapped: {
                    activeView = .conversation(nil)
                },
                onSettingsTapped: {
                    showingSettings = true
                },
                onNewProjectTapped: {
                    showingCreateProject = true
                },
                onProjectTapped: { project in
                    activeView = .project(project)
                },
                onConversationTapped: { conversation in
                    // Use manual animator - immune to SwiftUI view hierarchy changes
                    drawerAnimator.setOffset(0, animated: true)
                    isDrawerOpen = false
                    activeView = .conversation(conversation)
                },
                onShowToast: { message in
                    showToast(message: message)
                }
            )
            .frame(width: drawerWidth)
            // Drawer offset also uses manual animator for perfect sync
            .offset(x: drawerAnimator.offset - drawerWidth + dragOffset)
        }
        // Toast overlay
        .overlay(alignment: .bottom) {
            if showToast {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.white)
                    Text(toastMessage)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(
                    Capsule()
                        .fill(Color.black)
                        .shadow(color: .black.opacity(0.25), radius: 8, x: 0, y: 4)
                )
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .padding(.bottom, 24)
                .allowsHitTesting(false)
                .animation(.spring(response: 0.3, dampingFraction: 0.8), value: showToast)
            }
        }
        .onChange(of: isDrawerOpen) { _, newValue in
            drawerAnimator.setOffset(newValue ? drawerWidth : 0, animated: true)
        }
        .sheet(isPresented: $showingSettings) {
            SettingsView()
                .environmentObject(FirebaseManager.shared)
        }
        .sheet(isPresented: $showingCreateProject) {
            ProjectFormView(mode: .create) { name, description, color, icon in
                Task {
                    if let newProject = try? await projectsViewModel.createProject(
                        name: name,
                        description: description,
                        color: color,
                        icon: icon
                    ) {
                        await MainActor.run {
                            activeView = .project(newProject)
                        }
                    }
                }
            }
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showShareProjectPicker) {
            ShareProjectPickerSheet(
                projects: projectsViewModel.projects,
                onSelect: { project in
                    ShareHandoffManager.shared.rememberLastProject(project)
                    pendingShareProjectId = project.id
                    showShareProjectPicker = false
                    navigateToPendingShareProjectIfPossible()
                },
                onCancel: {
                    pendingShareProjectId = nil
                    showShareProjectPicker = false
                }
            )
            .presentationDetents([.medium, .large])
        }
        .onAppear {
            if let userId = Auth.auth().currentUser?.uid {
                projectsViewModel.startListening(userId: userId)
            }
        }
        .onDisappear {
            projectsViewModel.stopListening()
        }
        .onReceive(NotificationCenter.default.publisher(for: .sharedFilesQueued)) { notification in
            handleSharedFilesNotification(notification)
        }
        .onChange(of: projectsViewModel.projects) { _, _ in
            navigateToPendingShareProjectIfPossible()
        }
    }
    
    // MARK: - Content View (switches based on activeView)
    @ViewBuilder
    private var contentView: some View {
        switch activeView {
        case .conversation(let conversation):
            ConversationView(
                existingConversation: conversation,
                onMenuTapped: toggleDrawer,
                onSettingsTapped: { showingSettings = true },
                showHeader: true
            )
            .id(conversation?.id ?? "new")
            .transition(.identity) // No transition animation - prevents interference with offset animation
            
        case .newConversation(let pillarIds, let initialMessage):
            ConversationView(
                pillarIds: pillarIds,
                initialMessage: initialMessage,
                onMenuTapped: toggleDrawer,
                onSettingsTapped: { showingSettings = true },
                showHeader: true
            )
            .id("new-\(pillarIds.joined())-\(initialMessage)")
            .transition(.identity)
            
        case .project(let project):
            ProjectDetailView(
                project: project,
                onMenuTapped: toggleDrawer,
                onStartConversation: { pillarIds, initialMessage in
                    print("🚀 [MainTabView] onStartConversation called")
                    print("🚀 [MainTabView] pillarIds: \(pillarIds)")
                    print("🚀 [MainTabView] initialMessage: \(initialMessage)")
                    // Navigate to new conversation with pillar context
                    activeView = .newConversation(pillarIds: pillarIds, initialMessage: initialMessage)
                },
                onOpenConversation: { conversation in
                    // Used when navigation style is "jump"
                    print("📱 [MainTabView] onOpenConversation (jump) called: \(conversation.id)")
                    activeView = .conversation(conversation)
                },
                onCreateProjectTapped: {
                    showingCreateProject = true
                }
            )
            .id(project.id)
            .transition(.identity)
            
        case .forYou:
            ForYouView(onMenuTapped: toggleDrawer)
            
        case .library:
            LibraryView(onMenuTapped: toggleDrawer)
            
        case .vibes:
            VibesView(onMenuTapped: toggleDrawer)
        }
    }
    
    private var selectedConversationId: String? {
        if case let .conversation(conversation) = activeView {
            return conversation?.id
        }
        return nil
    }
    
    // MARK: - Scrim Opacity
    // Uses manual animator offset for perfect sync with drawer animation
    private var scrimOpacity: Double {
        let maxOpacity: Double = 0.3
        // Combine the animated offset with drag offset for total visual offset
        let totalOffset = drawerAnimator.offset + dragOffset
        // Normalize to 0-1 range (0 = closed, 1 = fully open)
        let progress = max(0, min(1, totalOffset / drawerWidth))
        return maxOpacity * progress
    }
    
    // MARK: - Actions
    private func toggleDrawer() {
        if !isDrawerOpen {
            dismissKeyboard()
        }
        isDrawerOpen.toggle()
        drawerAnimator.setOffset(isDrawerOpen ? drawerWidth : 0, animated: true)
    }
    
    private func handleSharedFilesNotification(_ notification: Notification) {
        // Use remembered project when available; otherwise prompt to pick.
        let targetProjectId = notification.userInfo?["projectId"] as? String ?? ShareHandoffManager.shared.lastProjectId
        
        if let targetProjectId {
            pendingShareProjectId = targetProjectId
            navigateToPendingShareProjectIfPossible()
        } else {
            // No preferred project stored; ask the user to pick one.
            showShareProjectPicker = true
        }
    }
    
    private func navigateToPendingShareProjectIfPossible() {
        guard
            let pendingId = pendingShareProjectId,
            let project = projectsViewModel.projects.first(where: { $0.id == pendingId })
        else { return }
        
        pendingShareProjectId = nil
        activeView = .project(project)
        isDrawerOpen = false
        drawerAnimator.setOffset(0, animated: true)
    }
    
    private func dismissKeyboard() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
    
    private func showToast(message: String) {
        toastMessage = message
        withAnimation {
            showToast = true
        }
        
        // Auto-dismiss after 2 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            withAnimation {
                showToast = false
            }
        }
    }
    
    // MARK: - Drawer Gesture
    private var drawerGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                let translation = value.translation.width
                if isDrawerOpen {
                    if translation < 0 {
                        dragOffset = translation
                    }
                } else {
                    if translation > 0 && value.startLocation.x < 30 {
                        dragOffset = min(translation, drawerWidth)
                    }
                }
            }
            .onEnded { value in
                let threshold = drawerWidth * 0.3
                
                if isDrawerOpen {
                    if value.translation.width < -threshold || value.predictedEndTranslation.width < -threshold {
                        isDrawerOpen = false
                        drawerAnimator.setOffset(0, animated: true)
                    }
                } else {
                    if dragOffset > threshold || value.predictedEndTranslation.width > threshold {
                        dismissKeyboard()
                        isDrawerOpen = true
                        drawerAnimator.setOffset(drawerWidth, animated: true)
                    }
                }
                
                // Reset drag offset (this can still use SwiftUI animation since it's separate)
                withAnimation(.spring(response: animationResponse, dampingFraction: 0.8)) {
                    dragOffset = 0
                }
            }
    }
}

// MARK: - Share Project Picker
private struct ShareProjectPickerSheet: View {
    let projects: [Project]
    let onSelect: (Project) -> Void
    let onCancel: () -> Void
    
    var body: some View {
        NavigationStack {
            List {
                if projects.isEmpty {
                    Text("No projects available. Create one first.")
                        .foregroundColor(.secondary)
                } else {
                    ForEach(projects, id: \.id) { project in
                        Button {
                            onSelect(project)
                        } label: {
                            HStack {
                                Text(project.name)
                                    .foregroundColor(.primary)
                                Spacer()
                                if ShareHandoffManager.shared.lastProjectId == project.id {
                                    Text("Last used")
                                        .font(.footnote)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Send shared file to…")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
            }
        }
    }
}

