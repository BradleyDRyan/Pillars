//
//  Drawer.swift
//  Pillars
//
//  Drawer for push-style drawer navigation
//

import SwiftUI
import FirebaseAuth

struct Drawer: View {
    @Binding var isDrawerOpen: Bool
    let onChatTapped: () -> Void
    let onAvatarTapped: (() -> Void)?
    let onSettingsTapped: () -> Void
    let onConversationTapped: ((Conversation) -> Void)?
    
    @StateObject private var viewModel = DrawerViewModel()
    @EnvironmentObject var firebaseManager: FirebaseManager
    
    init(
        isDrawerOpen: Binding<Bool>,
        onChatTapped: @escaping () -> Void,
        onAvatarTapped: (() -> Void)? = nil,
        onSettingsTapped: @escaping () -> Void,
        onConversationTapped: ((Conversation) -> Void)? = nil
    ) {
        self._isDrawerOpen = isDrawerOpen
        self.onChatTapped = onChatTapped
        self.onAvatarTapped = onAvatarTapped
        self.onSettingsTapped = onSettingsTapped
        self.onConversationTapped = onConversationTapped
    }
    
    var body: some View {
        ScrollView(showsIndicators: false) {
            DrawerSections(
                isDrawerOpen: $isDrawerOpen,
                onConversationTapped: onConversationTapped,
                viewModel: viewModel
            )
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .scrollEdgeEffectStyle(.soft, for: .all)
        .safeAreaBar(edge: .top) {
            DrawerHeader(
                onAvatarTapped: { onAvatarTapped?() },
                onMenuTapped: onSettingsTapped
            )
        }
        .safeAreaBar(edge: .bottom) {
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
        isDrawerOpen: .constant(true),
        onChatTapped: {},
        onSettingsTapped: {}
    )
    .frame(width: 320)
}

