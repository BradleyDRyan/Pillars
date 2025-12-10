//
//  ActivityView.swift
//  Squirrel2
//
//  Main view for displaying user activity and conversation history
//

import SwiftUI
import FirebaseAuth

struct ActivityView: View {
    @StateObject private var viewModel = ActivityViewModel()
    @EnvironmentObject var firebaseManager: FirebaseManager
    @State private var navigationPath = NavigationPath()
    @State private var selectedConversation: Conversation?

    var body: some View {
        NavigationStack(path: $navigationPath) {
            VStack(spacing: 0) {
                // Custom header
                ActivityHeader()

                // Main content
                if viewModel.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.conversations.isEmpty {
                    ActivityEmptyState()
                } else {
                    ActivityList(viewModel: viewModel) { conversation in
                        selectConversation(conversation)
                    }
                }
            }
            .navigationBarHidden(true)
        }
        .fullScreenCover(item: $selectedConversation) { conversation in
            ConversationView(existingConversation: conversation)
                .environmentObject(firebaseManager)
                .onAppear {
                    print("🚀 [ActivityView] ConversationView appeared with: \(conversation.id)")
                }
        }
        .onAppear {
            print("🎯 [ActivityView] View appeared")
            print("🔐 [ActivityView] Current user: \(firebaseManager.currentUser?.uid ?? "nil")")
            if let userId = firebaseManager.currentUser?.uid {
                print("✅ [ActivityView] Starting to listen with userId: \(userId)")
                viewModel.startListening(userId: userId)
            } else {
                print("❌ [ActivityView] No user ID available")
            }
        }
        .onDisappear {
            viewModel.stopListening()
        }
    }

    private func selectConversation(_ conversation: Conversation) {
        print("🔵 [ActivityView] User tapped conversation:")
        print("  - ID: \(conversation.id)")
        print("  - Title: \(conversation.title)")
        print("  - Last message: \(conversation.lastMessage ?? "none")")
        selectedConversation = conversation
    }
}