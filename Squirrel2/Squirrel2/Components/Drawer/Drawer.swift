//
//  Drawer.swift
//  Squirrel2
//
//  Drawer for push-style drawer navigation
//  Supports drag and drop of chats into projects
//

import SwiftUI
import FirebaseAuth

struct Drawer: View {
    @Binding var selectedSection: Int
    @Binding var isDrawerOpen: Bool
    let selectedConversationId: String?
    let onChatTapped: () -> Void
    let onAvatarTapped: (() -> Void)?
    let onSettingsTapped: () -> Void
    let onNewProjectTapped: (() -> Void)?
    let onProjectTapped: ((Project) -> Void)?
    let onConversationTapped: ((Conversation) -> Void)?
    let onShowToast: ((String) -> Void)?
    
    @StateObject private var viewModel = DrawerViewModel()
    @EnvironmentObject var firebaseManager: FirebaseManager
    
    init(
        selectedSection: Binding<Int>,
        selectedConversationId: String? = nil,
        isDrawerOpen: Binding<Bool>,
        onChatTapped: @escaping () -> Void,
        onAvatarTapped: (() -> Void)? = nil,
        onSettingsTapped: @escaping () -> Void,
        onNewProjectTapped: (() -> Void)? = nil,
        onProjectTapped: ((Project) -> Void)? = nil,
        onConversationTapped: ((Conversation) -> Void)? = nil,
        onShowToast: ((String) -> Void)? = nil
    ) {
        self._selectedSection = selectedSection
        self.selectedConversationId = selectedConversationId
        self._isDrawerOpen = isDrawerOpen
        self.onChatTapped = onChatTapped
        self.onAvatarTapped = onAvatarTapped
        self.onSettingsTapped = onSettingsTapped
        self.onNewProjectTapped = onNewProjectTapped
        self.onProjectTapped = onProjectTapped
        self.onConversationTapped = onConversationTapped
        self.onShowToast = onShowToast
    }
    
    var body: some View {
        // Nav body - scrollable with header in safeAreaBar
        ScrollView(showsIndicators: false) {
            DrawerSections(
                selectedSection: $selectedSection,
                isDrawerOpen: $isDrawerOpen,
                selectedConversationId: selectedConversationId,
                onNewProjectTapped: onNewProjectTapped,
                onProjectTapped: onProjectTapped,
                onConversationTapped: onConversationTapped,
                onShowToast: onShowToast,
                viewModel: viewModel
            )
            // Figma: Nav Body x=12 (12px horizontal padding)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .scrollEdgeEffectStyle(.soft, for: .all)
        .safeAreaBar(edge: .top) {
            // Header bar - safeAreaBar handles safe area automatically
            DrawerHeader(
                onAvatarTapped: { onAvatarTapped?() },
                onMenuTapped: onSettingsTapped
            )
        }
        .safeAreaBar(edge: .bottom) {
            // Footer bar - safeAreaBar handles safe area automatically
            DrawerFooter(onChatTapped: {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                    isDrawerOpen = false
                }
                onChatTapped()
            })
        }
        .background(Color.white)
        .onAppear {
            if let userId = firebaseManager.currentUser?.uid {
                viewModel.startListening(userId: userId)
            }
        }
        .onDisappear {
            viewModel.stopListening()
        }
    }
}

#Preview {
    Drawer(
        selectedSection: .constant(0),
        selectedConversationId: nil,
        isDrawerOpen: .constant(true),
        onChatTapped: {},
        onSettingsTapped: {}
    )
    .frame(width: 320)
}

