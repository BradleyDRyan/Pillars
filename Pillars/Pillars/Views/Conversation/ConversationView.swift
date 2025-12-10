//
//  ConversationView.swift
//  Squirrel2
//
//  Main conversation view - ChatGPT-style interface
//

import SwiftUI
import UIKit
import FirebaseAuth
import MarkdownUI

struct ConversationView: View {
    @StateObject private var textViewModel = ConversationViewModel()
    @StateObject private var menuViewModel = DrawerViewModel()
    @StateObject private var voiceAI = VoiceAIManager.shared
    @EnvironmentObject var firebaseManager: FirebaseManager
    
    // Navigation callbacks (optional - for drawer integration)
    var onMenuTapped: (() -> Void)?
    var onSettingsTapped: (() -> Void)?
    var onCreateProjectTapped: (() -> Void)?
    var showHeader: Bool = true
    
    @State private var chatMode: ChatMode = .text
    @State private var conversationId: String?
    @State private var inputText = ""
    @Environment(\.dismiss) private var dismiss
    @State private var isInitializing = false
    @State private var hasInitialized = false
    @State private var lastInputSignature: String?
    @State private var setupTask: Task<Void, Never>?
    @State private var hasScrolledToBottom = false
    @FocusState private var isInputFocused: Bool
    
    // Menu state
    @State private var showRenameAlert = false
    @State private var renameText = ""
    @State private var conversationForMenu: Conversation?
    @State private var showDeleteConfirmation = false
    
    // Optional existing conversation (from History)
    let existingConversation: Conversation?
    
    // Pillar IDs to assign to new conversation
    let pillarIds: [String]
    
    // Initial message to send after setup (for starting from pillar view)
    let initialMessage: String?
    
    init(existingConversation: Conversation? = nil,
         pillarIds: [String] = [],
         initialMessage: String? = nil,
         onMenuTapped: (() -> Void)? = nil,
         onSettingsTapped: (() -> Void)? = nil,
         onCreateProjectTapped: (() -> Void)? = nil,
         showHeader: Bool = true) {
        print("🎬 [ConversationView] init called")
        print("🎬 [ConversationView] existingConversation: \(existingConversation?.id ?? "nil")")
        print("🎬 [ConversationView] pillarIds: \(pillarIds)")
        print("🎬 [ConversationView] initialMessage: \(initialMessage ?? "nil")")
        
        self.existingConversation = existingConversation
        self.pillarIds = pillarIds
        self.initialMessage = initialMessage
        self.onMenuTapped = onMenuTapped
        self.onSettingsTapped = onSettingsTapped
        self.onCreateProjectTapped = onCreateProjectTapped
        self.showHeader = showHeader
    }
    
    enum ChatMode: String, CaseIterable {
        case text = "Text"
        case voice = "Voice"
    }
    
    var body: some View {
        Group {
            if isInitializing {
                // Loading state
                VStack {
                    if showHeader {
                        ConversationHeader(
                            onMenuTapped: onMenuTapped ?? {},
                            onSettingsTapped: onSettingsTapped ?? { dismiss() },
                            moreMenu: headerMenuContent
                        )
                    }
                    Spacer()
                    ProgressView()
                    Spacer()
                }
            } else {
                // Messages area with scroll edge effects
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 16) {
                            ForEach(textViewModel.messages) { message in
                                // Render content blocks in order (text and tool calls interleaved)
                                MessageContentView(message: message)
                                    .id(message.id)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 16)
                    }
                    .scrollEdgeEffectStyle(.soft, for: .top)
                    .scrollEdgeEffectStyle(.soft, for: .bottom)
                    .onChange(of: textViewModel.messages.count) { _, _ in
                        if let lastMessage = textViewModel.messages.last {
                            if hasScrolledToBottom {
                                withAnimation {
                                    proxy.scrollTo(lastMessage.id, anchor: .bottom)
                                }
                            } else {
                                proxy.scrollTo(lastMessage.id, anchor: .bottom)
                                hasScrolledToBottom = true
                            }
                        }
                    }
                    .safeAreaBar(edge: .bottom) {
                        // Composer bar - enables bottom scroll edge effect
                        Composer(
                            placeholder: "Ask Meta AI",
                            text: $inputText,
                            isLoading: textViewModel.isStreaming,
                            onSend: sendMessage,
                            onVoice: { chatMode = .voice }
                        )
                        .focused($isInputFocused)
                    }
                }
            }
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
        .background {
            Color.white.ignoresSafeArea()
        }
        .onAppear {
            print("👁️ [ConversationView] onAppear - signature: \(inputSignature)")
            conversationForMenu = existingConversation
            if let userId = firebaseManager.currentUser?.uid {
                menuViewModel.startListening(userId: userId)
            }
            processInputSignatureChange()
        }
        .onChange(of: inputSignature) { _, newSignature in
            print("🔄 [ConversationView] inputSignature changed -> \(newSignature)")
            processInputSignatureChange()
        }
        .onDisappear {
            // Dismiss keyboard when leaving
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
            
            setupTask?.cancel()
            menuViewModel.stopListening()
            Task {
                if voiceAI.isConnected {
                    await voiceAI.disconnect()
                }
            }
        }
        .fullScreenCover(isPresented: Binding(
            get: { chatMode == .voice },
            set: { if !$0 { chatMode = .text } }
        )) {
            VoiceModeView(
                voiceAI: voiceAI,
                onModeSwitch: { chatMode = .text },
                onDismiss: { chatMode = .text },
                onToggleVoice: toggleVoice
            )
        }
        // Native iOS toolbar
        .toolbar {
            if showHeader {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        onMenuTapped?()
                    } label: {
                        Image(systemName: "line.3.horizontal")
                    }
                }
            }
            
            ToolbarItem(placement: .topBarTrailing) {
                if let menuContent = headerMenuContent {
                    Menu {
                        menuContent()
                    } label: {
                        Image(systemName: "ellipsis")
                    }
                } else {
                    Button {
                        onSettingsTapped?() ?? dismiss()
                    } label: {
                        Image(systemName: "ellipsis")
                    }
                }
            }
        }
        // Update conversationForMenu when textViewModel.conversation changes (for new conversations)
        .onChange(of: textViewModel.conversation?.id) { _, newId in
            if let newId = newId, conversationForMenu == nil {
                conversationForMenu = textViewModel.conversation
                print("📋 [ConversationView] Updated conversationForMenu: \(newId)")
            }
        }
    }
    
    // MARK: - Actions
    
    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        
        inputText = ""
        
        // Use the send() method from ConversationViewModel
        textViewModel.send(text)
    }
    
    private func toggleVoice() {
        if voiceAI.isListening {
            Task { await voiceAI.stopListening() }
        } else {
            Task {
                do { try await voiceAI.startListening() }
                catch { print("Error starting voice: \(error)") }
            }
        }
    }
    
    // MARK: - Setup
    
    private func initializeChat() {
        print("🎬 [ConversationView] initializeChat() called")
        print("🎬 [ConversationView] hasInitialized: \(hasInitialized), isInitializing: \(isInitializing)")
        setupTask?.cancel()
        isInitializing = true
        let signature = inputSignature
        setupTask = Task {
            await setupConversation(expectedSignature: signature)
        }
    }
    
    private func setupConversation(expectedSignature: String) async {
        print("🔧 [ConversationView] setupConversation() starting")
        print("🔧 [ConversationView] existingConversation?.id: \(existingConversation?.id ?? "nil")")
        print("🔧 [ConversationView] conversationId: \(conversationId ?? "nil")")
        print("🔧 [ConversationView] pillarIds: \(pillarIds)")
        print("🔧 [ConversationView] initialMessage: \(initialMessage ?? "nil")")
        
        let convId = existingConversation?.id ?? conversationId
        print("🔧 [ConversationView] Using convId: \(convId ?? "nil - will create new")")
        
        await textViewModel.setup(
            conversationId: convId,
            existingConversation: existingConversation,
            pillarIds: pillarIds
        )
        
        if Task.isCancelled {
            print("⏹️ [ConversationView] setupConversation cancelled post-setup")
            return
        }
        
        guard expectedSignature == lastInputSignature else {
            print("⚠️ [ConversationView] Signature changed mid-setup, discarding results")
            return
        }
        
        print("🔧 [ConversationView] textViewModel.setup() completed")
        print("🔧 [ConversationView] textViewModel.conversation?.id: \(textViewModel.conversation?.id ?? "nil")")
        
        if let finalConvId = textViewModel.conversation?.id {
            self.conversationId = finalConvId
            hasInitialized = true
            print("✅ [ConversationView] Conversation ready: \(finalConvId)")
            
            // Send initial message if provided (e.g., from project view)
            if let message = initialMessage, !message.isEmpty {
                print("📤 [ConversationView] Sending initial message: '\(message)'")
                textViewModel.send(message)
            } else {
                print("ℹ️ [ConversationView] No initial message to send")
            }
        } else {
            print("❌ [ConversationView] Failed to get conversation ID after setup")
        }
        isInitializing = false
        print("🔧 [ConversationView] setupConversation() complete")
    }
    
    // MARK: - Input Signature Handling
    
    private var inputSignature: String {
        if let conversation = existingConversation {
            return "conversation-\(conversation.id)"
        }
        let pillarsKey = pillarIds.sorted().joined(separator: ",")
        let initial = initialMessage ?? ""
        return "new-\(pillarsKey)-\(initial)"
    }
    
    private func processInputSignatureChange() {
        let signature = inputSignature
        guard signature != lastInputSignature else {
            print("ℹ️ [ConversationView] Signature unchanged, skipping re-init")
            return
        }
        
        print("🆕 [ConversationView] Processing new signature: \(signature)")
        lastInputSignature = signature
        resetConversationState()
        initializeChat()
    }
    
    private func resetConversationState() {
        setupTask?.cancel()
        textViewModel.cleanup()
        conversationId = existingConversation?.id
        inputText = ""
        hasInitialized = false
        isInitializing = false
        hasScrolledToBottom = false
    }
    
    // MARK: - Menu Content
    private var headerMenuContent: (() -> ConversationMenuContent)? {
        guard let conversation = conversationForMenu else { return nil }
        return {
            ConversationMenuContent(
                conversation: conversation,
                projects: menuViewModel.projects,
                onAddToProject: { conv, project in
                    menuViewModel.assignConversationToProject(conversation: conv, project: project)
                },
                onRemoveFromProject: { conv, project in
                    menuViewModel.removeConversationFromProject(conversation: conv, project: project)
                },
                onCreateProject: {
                    onCreateProjectTapped?()
                },
                onRename: { conv in
                    renameText = conv.title
                    conversationForMenu = conv
                    showRenameAlert = true
                },
                onShare: { conv in
                    shareConversation(conv)
                },
                onDelete: { conv in
                    conversationForMenu = conv
                    showDeleteConfirmation = true
                }
            )
        }
    }
    
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

// MARK: - Conversation Header
struct ConversationHeader<MoreContent: View>: View {
    let onMenuTapped: () -> Void
    let onSettingsTapped: () -> Void
    var moreMenu: (() -> MoreContent)?
    
    var body: some View {
        HStack {
            IconButton(icon: "Menu", action: onMenuTapped)
            Spacer()
            
            if let moreMenu {
                Menu {
                    moreMenu()
                } label: {
                    IconButton(icon: "ThreeDot", action: {})
                }
            } else {
                IconButton(icon: "ThreeDot", action: onSettingsTapped)
            }
        }
        // Match DrawerHeader: 20px horizontal, 8px bottom
        .padding(.horizontal, 20)
        // Bottom padding only - safeAreaBar handles top safe area automatically
        .padding(.bottom, 8)
    }
}

// MARK: - Message Bubble
// MARK: - Message Content View (renders content blocks in order)
struct MessageContentView: View {
    let message: ConversationViewModel.Message
    
    // Show typing indicator only when streaming with no content yet
    private var isWaitingForContent: Bool {
        message.isStreaming && message.contentBlocks.isEmpty
    }
    
    var body: some View {
        if message.role == .user {
            // User message: bubble aligned right (simple text)
            HStack {
                Spacer(minLength: 60)
                
                StreamingMarkdownView(
                    content: message.content,
                    isStreaming: message.isStreaming,
                    role: message.role
                )
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 20)
                        .fill(S2.Colors.secondarySurface)
                )
            }
        } else {
            // Assistant message: render content blocks in order
            if isWaitingForContent {
                // Typing indicator while waiting for first content
                HStack {
                    TypingIndicator()
                    Spacer()
                }
                .padding(.vertical, 4)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(message.contentBlocks) { block in
                        switch block {
                        case .text(let text):
                            // Text block
                            StreamingMarkdownView(
                                content: text,
                                isStreaming: message.isStreaming,
                                role: message.role
                            )
                            .frame(maxWidth: .infinity, alignment: .leading)
                            
                        case .toolCall(let toolCall):
                            // Tool call block (inline where it was called)
                            ToolCallView(toolCall: toolCall)
                        }
                    }
                }
            }
        }
    }
}

struct MessageBubble: View {
    let message: ConversationViewModel.Message
    
    // Show typing indicator only when streaming with no content yet
    private var isWaitingForContent: Bool {
        message.isStreaming && message.content.isEmpty
    }
    
    var body: some View {
        if message.role == .user {
            // User message: bubble aligned right
            HStack {
                Spacer(minLength: 60)
                
                StreamingMarkdownView(
                    content: message.content,
                    isStreaming: message.isStreaming,
                    role: message.role
                )
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 20)
                        .fill(S2.Colors.secondarySurface)
                )
            }
        } else {
            // Assistant message: plain text, full width, no bubble (like ChatGPT)
            if isWaitingForContent {
                // Typing indicator while waiting for first content
                HStack {
                    TypingIndicator()
                    Spacer()
                }
                .padding(.vertical, 4)
            } else {
                StreamingMarkdownView(
                    content: message.content,
                    isStreaming: message.isStreaming,
                    role: message.role
                )
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

// MARK: - Typing Indicator
struct TypingIndicator: View {
    @State private var isAnimating = false
    
    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(Color.gray.opacity(0.6))
                    .frame(width: 6, height: 6)
                    .offset(y: isAnimating ? -4 : 0)
                    .animation(
                        .easeInOut(duration: 0.4)
                        .repeatForever(autoreverses: true)
                        .delay(Double(index) * 0.15),
                        value: isAnimating
                    )
            }
        }
        .onAppear {
            isAnimating = true
        }
    }
}

#Preview {
    ConversationView()
}
